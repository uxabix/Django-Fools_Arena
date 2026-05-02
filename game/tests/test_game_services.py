"""Unit tests for `game.services` lobby and gameplay helpers."""

import pytest
from django.contrib.auth import get_user_model

from game.models import Game, Lobby, LobbyPlayer
from game.services import GameError, create_lobby, join_lobby, set_ready, start_game

User = get_user_model()


@pytest.mark.django_db
class TestLobbyServices:
    """Tests for lobby creation, joining, and game start preconditions."""

    def test_create_public_lobby(self, test_user):
        """A public lobby should persist with settings and owner membership."""
        lobby = create_lobby(test_user, "Room A", is_private=False)
        assert lobby.name == "Room A"
        assert not lobby.is_private
        assert LobbyPlayer.objects.filter(lobby=lobby, user=test_user).exists()

    def test_private_lobby_requires_password_on_create(self, test_user):
        """Serializer layer enforces password; service still stores hash when given."""
        lobby = create_lobby(
            test_user, "Secret", is_private=True, password="hunter2"
        )
        assert lobby.is_private
        assert lobby.password_hash

    def test_join_wrong_password(self, test_user, second_user, user_factory):
        """Joining a private lobby with a bad password raises GameError."""
        host = user_factory(username="host_x")
        lobby = create_lobby(host, "P", is_private=True, password="ok")
        with pytest.raises(GameError) as exc:
            join_lobby(lobby, test_user, password="nope")
        assert exc.value.code == "auth"

    def test_start_game_requires_owner(self, test_user, second_user, durak_deck_36):
        """Only the lobby owner may call `start_game`."""
        lobby = create_lobby(test_user, "G1", is_private=False)
        join_lobby(lobby, second_user)
        set_ready(lobby, test_user, True)
        set_ready(lobby, second_user, True)
        with pytest.raises(GameError) as exc:
            start_game(lobby, second_user)
        assert exc.value.code == "forbidden"

    def test_start_game_happy_path(self, test_user, second_user, durak_deck_36):
        """Two ready players and a seeded deck produce an in-progress `Game`."""
        lobby = create_lobby(test_user, "G2", is_private=False)
        join_lobby(lobby, second_user)
        set_ready(lobby, test_user, True)
        set_ready(lobby, second_user, True)
        game = start_game(lobby, test_user)
        assert game.status == "in_progress"
        assert game.players.count() == 2
        assert "attacker_id" in (game.runtime_state or {})
        lobby.refresh_from_db()
        assert lobby.status == "playing"


@pytest.mark.django_db
def test_active_game_blocks_second_start(test_user, second_user, durak_deck_36):
    """Starting again while a game is in progress must raise GameError."""
    lobby = create_lobby(test_user, "G3", is_private=False)
    join_lobby(lobby, second_user)
    set_ready(lobby, test_user, True)
    set_ready(lobby, second_user, True)
    start_game(lobby, test_user)
    # Lobby still 'playing' but can_start_game is False — service checks active Game.
    with pytest.raises(GameError) as exc:
        start_game(lobby, test_user)
    assert exc.value.code == "state"
