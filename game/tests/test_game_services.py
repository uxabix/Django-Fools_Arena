"""Unit tests for `game.services` lobby and gameplay helpers."""

import pytest
from django.contrib.auth import get_user_model

from game.models import Card, CardRank, CardSuit, GameDeck, Lobby, LobbyPlayer, PlayerHand
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

    def test_start_game_dedupes_duplicate_suit_rank_rows(self, test_user, second_user, durak_deck_36):
        """Duplicate ``Card`` rows for the same suit+rank must not appear in one shoe."""
        hearts = CardSuit.objects.get(name="Hearts")
        ace = CardRank.objects.get(value=14)
        Card.objects.create(suit=hearts, rank=ace)
        lobby = create_lobby(test_user, "G-dedupe", is_private=False)
        join_lobby(lobby, second_user)
        set_ready(lobby, test_user, True)
        set_ready(lobby, second_user, True)
        game = start_game(lobby, test_user)
        hand_ids = list(PlayerHand.objects.filter(game=game).values_list("card_id", flat=True))
        assert len(hand_ids) == len(set(hand_ids))
        suit_rank = {
            (ph.card.suit_id, ph.card.rank_id)
            for ph in PlayerHand.objects.filter(game=game).select_related("card")
        }
        assert len(suit_rank) == len(hand_ids)
        trump_id = game.trump_card_id
        assert trump_id not in hand_ids
        assert not GameDeck.objects.filter(game=game, card_id=trump_id).exists()

    def test_start_game_auto_seeds_cards_when_missing(self, test_user, second_user, durak_deck_36):
        """If normal playing cards were removed, ``start_game`` repopulates the catalog."""
        lobby = create_lobby(test_user, "G-autoseed", is_private=False)
        join_lobby(lobby, second_user)
        set_ready(lobby, test_user, True)
        set_ready(lobby, second_user, True)
        Card.objects.filter(special_card__isnull=True).delete()
        assert Card.objects.filter(special_card__isnull=True).count() == 0
        game = start_game(lobby, test_user)
        assert game.status == "in_progress"
        assert Card.objects.filter(special_card__isnull=True).count() >= 36


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
