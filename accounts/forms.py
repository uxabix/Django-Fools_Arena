"""
Forms for the Accounts app.

This module defines form classes used for user registration and login.
They extend Django's built-in authentication forms to include additional
fields or custom behavior where necessary.

Available forms:
    - RegistrationForm: extends UserCreationForm to include an email field.
    - LoginForm: extends AuthenticationForm for user login.
"""

from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import get_user_model

User = get_user_model()

class RegistrationForm(UserCreationForm):
    """
    Form for user registration.

    Extends Django's built-in UserCreationForm by adding
    a required email field. Handles validation and creation
    of a new user instance with username, email, and password.
    """
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in self.fields:
            field = self.fields[name]
            if field.widget.input_type == "checkbox":
                continue
            field.widget.attrs.setdefault("class", "fools-input")
            if "password" in name:
                field.widget.attrs["autocomplete"] = "new-password"
            elif name == "username":
                field.widget.attrs["autocomplete"] = "username"
            elif name == "email":
                field.widget.attrs["autocomplete"] = "email"


class LoginForm(AuthenticationForm):
    """
    Form for user login.

    Extends Django's built-in AuthenticationForm without
    additional fields. Used to authenticate existing users
    with their username and password.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].widget.attrs.update(
            {"class": "fools-input", "autocomplete": "username"}
        )
        self.fields["password"].widget.attrs.update(
            {"class": "fools-input", "autocomplete": "current-password"}
        )
