"""Messaging rules and permission checks for the chat application.

This module centralizes direct-message blocking using ``accounts.Block``
and validation before messages are stored or broadcast.
"""

from accounts.models import Block


def is_direct_message_blocked(sender, recipient):
    """Return True if ``recipient`` has blocked ``sender`` (sender cannot DM).

    Args:
        sender: User attempting to send a message.
        recipient: The other party in a direct chat.

    Returns:
        bool: True when a block prevents ``sender`` from messaging ``recipient``.
    """
    if sender.pk == recipient.pk:
        return False
    return Block.objects.filter(blocker=recipient, blocked=sender).exists()


def assert_can_send_message(chat, sender):
    """Raise ``PermissionError`` if ``sender`` may not post in ``chat``.

    Lobby and global channels ignore pairwise blocks so existing behaviour stays
    unchanged.

    Args:
        chat: Target ``Chat`` instance.
        sender: Authenticated user posting the message.

    Raises:
        PermissionError: If the direct counterpart has blocked the sender or the
            chat configuration is invalid for DM.
    """
    if not chat.is_direct_message():
        return

    other = chat.get_other_participant(sender)
    if other is None:
        raise PermissionError("Direct chat has no valid counterpart.")

    if is_direct_message_blocked(sender, other):
        raise PermissionError("You cannot send messages to this user.")
