import { Action } from 'redux';
import {
  BASIC_AUTH_SIGN_IN,
  BASIC_AUTH_SIGN_IN_FAILED,
  BASIC_AUTH_SIGN_IN_SUCCESS,
  CHECK_AUTHENTICATION,
  CHECK_AUTHENTICATION_FAILED,
  CHECK_AUTHENTICATION_SUCCESS,
  KEYCLOAK_REFRESH_TOKEN,
  KEYCLOAK_REFRESH_TOKEN_FAILED,
  KEYCLOAK_REFRESH_TOKEN_SUCCESS,
  KEYCLOAK_SIGN_IN,
  KEYCLOAK_SIGN_IN_FAILED,
  KEYCLOAK_SIGN_IN_SUCCESS,
  KEYCLOAK_SIGN_OUT,
  SIGN_OUT,
  SIGN_OUT_FAILED,
  SIGN_OUT_SUCCESS,
} from './AuthenticationActionTypes';
import * as Keycloak from 'keycloak-js';
import { AnyAction } from 'redux-saga';

export interface IBasicAuthSignInAction extends AnyAction {
  username: string;
  password: string;
}

export function basicAuthSignInAction(
  username: string,
  password: string,
): IBasicAuthSignInAction {
  return {
    username,
    password,
    type: BASIC_AUTH_SIGN_IN,
  };
}

export interface IBasicAuthSignInFailedAction extends AnyAction {
  error: Error;
}

export function basicAuthSignInFailedAction(
  error: Error,
): IBasicAuthSignInFailedAction {
  return {
    error,
    type: BASIC_AUTH_SIGN_IN_FAILED,
  };
}

export interface IBasicAuthSignInSuccessAction extends AnyAction { }

export function basicAuthSignInSuccessAction(): IBasicAuthSignInSuccessAction {
  return {
    type: BASIC_AUTH_SIGN_IN_SUCCESS,
  };
}

export interface IKeycloakSignInAction extends AnyAction {
  keycloak: Keycloak.KeycloakInstance;
}

export function keycloakSignInAction(
  keycloak: Keycloak.KeycloakInstance,
): IKeycloakSignInAction {
  return {
    keycloak,
    type: KEYCLOAK_SIGN_IN,
  };
}

export interface IKeycloakSignInSuccessAction extends AnyAction {
  keycloak: Keycloak.KeycloakInstance;
}

export function keycloakSignInSuccessAction(
  keycloak: Keycloak.KeycloakInstance,
): IKeycloakSignInSuccessAction {
  return {
    keycloak,
    type: KEYCLOAK_SIGN_IN_SUCCESS,
  };
}

export interface IKeycloakSignInFailedAction extends AnyAction {
  error: Error;
}

export function keycloakSignInFailedAction(
  error: Error,
): IKeycloakSignInFailedAction {
  return {
    error,
    type: KEYCLOAK_SIGN_IN_FAILED,
  };
}

export interface IKeycloakRefreshTokenAction extends AnyAction {
  keycloak: Keycloak.KeycloakInstance;
}

export function keycloakRefreshTokenAction(
  keycloak: Keycloak.KeycloakInstance,
): IKeycloakRefreshTokenAction {
  return {
    keycloak,
    type: KEYCLOAK_REFRESH_TOKEN,
  };
}

export interface IKeycloakRefreshTokenSuccessAction extends AnyAction { }

export function keycloakRefreshTokenSuccessAction(): IKeycloakRefreshTokenSuccessAction {
  return {
    type: KEYCLOAK_REFRESH_TOKEN_SUCCESS,
  };
}

export interface IKeycloakRefreshTokenFailedAction extends AnyAction {
  error: Error;
}

export function keycloakRefreshTokenFailedAction(
  error: Error,
): IKeycloakRefreshTokenFailedAction {
  return {
    error,
    type: KEYCLOAK_REFRESH_TOKEN_FAILED,
  };
}

export interface ISignOutAction extends AnyAction {
  keycloak: Keycloak.KeycloakInstance;
}

export function signOutAction(
  keycloak: Keycloak.KeycloakInstance,
): ISignOutAction {
  return {
    keycloak,
    type: SIGN_OUT,
  };
}

export interface ISignOutSuccessAction extends AnyAction { }

export function signOutSuccessAction(): ISignOutSuccessAction {
  return {
    type: SIGN_OUT_SUCCESS,
  };
}

export interface ISignOutFailedAction extends AnyAction {
  error: Error;
}

export function signOutFailedAction(error: Error): ISignOutFailedAction {
  return {
    error,
    type: SIGN_OUT_FAILED,
  };
}

export interface ICheckAuthenticationAction extends AnyAction { }

export function checkAuthenticationAction(): ICheckAuthenticationAction {
  return {
    type: CHECK_AUTHENTICATION,
  };
}

export interface ICheckAuthenticationSuccessAction extends AnyAction {
  isKeycloakEnabled: boolean;
  isBasicAuthEnabled: boolean;
  isReadOnly: boolean;
  keycloak: Keycloak.KeycloakInstance;
}

export function checkAuthenticationSuccessAction(
  isKeycloakEnabled: boolean,
  isBasicAuthEnabled: boolean,
  isReadOnly: boolean,
  keycloak: Keycloak.KeycloakInstance,
): ICheckAuthenticationSuccessAction {
  return {
    keycloak,
    isKeycloakEnabled,
    isBasicAuthEnabled,
    isReadOnly,
    type: CHECK_AUTHENTICATION_SUCCESS,
  };
}

export interface ICheckAuthenticationFailedAction extends AnyAction {
  error: Error;
}

export function checkAuthenticationFailedAction(
  error: Error,
): ICheckAuthenticationFailedAction {
  return {
    error,
    type: CHECK_AUTHENTICATION_FAILED,
  };
}
