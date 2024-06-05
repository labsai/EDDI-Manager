import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faCheck,
  faCheckCircle,
  faComments,
  faCompress,
  faEllipsisV,
  faExpand,
  faMinus,
  faPlus,
  faRedo,
  faSync,
  faUndo,
} from '@fortawesome/free-solid-svg-icons';
import * as Keycloak from 'keycloak-js';
import * as React from 'react';
import { connect } from 'react-redux';
import { Route, Routes, useLocation } from 'react-router-dom';
import ClimbingBoxLoader from 'react-spinners/ClimbingBoxLoader';
import { compose, pure, setDisplayName } from 'recompose';
import authenticationActionDispatchers from '../actions/AuthenticationActionDispatchers';
import SystemActionDispatchers from '../actions/SystemActionDispatchers';
import {
  CONVERSATIONS,
  PACKAGE_VIEW,
  PACKAGES,
  RESOURCES,
  BOT_VIEW,
  CONVERSATION_VIEW,
  MANAGE,
} from '../constants/paths';
import { run as runSagaMiddleware } from '../sagas';
import { authenticationSelector } from '../selectors/AuthenticationSelectors';
import { isChatOpenedSelector } from '../selectors/ChatSelectors';
import {
  isAppReadySelector,
  isLoadingSelector,
} from '../selectors/SystemSelectors';
import useStyles from './App.style';
import Chat from './Chat/Chat';
import Loader from './Loader/Loader';
import ModalComponentFrame from './ModalComponent/ModalComponentFrame';
import BotConversationViewPage from './pages/BotConversationViewPage';
import BotViewPage from './pages/BotViewPage';
import ConversationsPage from './pages/ConversationsPage';
import Dashboard from './pages/Dashboard';
import ExtensionsPage from './pages/ExtensionsPage';
import PackagePage from './pages/PackagePage';
import PackageViewPage from './pages/PackageViewPage';
import { setApiUrlQuery, setReadOnlyQuery } from './utils/ApiFunctions';
import * as kcHelper from './utils/keycloakFunctions';
import Parser from './utils/Parser';
import useChangeBodyMaxWidth from './utils/useChangeBodyMaxWidth';

library.add(faUndo);
library.add(faRedo);
library.add(faCheck);
library.add(faExpand);
library.add(faCompress);
library.add(faCheckCircle);
library.add(faEllipsisV);
library.add(faPlus);
library.add(faMinus);
library.add(faComments);
library.add(faSync);

interface IPrivateProps {
  isAppReady: boolean;
  keycloak: Keycloak.KeycloakInstance;
  isKeycloakEnabled: boolean;
  isBasicAuthEnabled: boolean;
  keycloakAuthenticated: boolean;
  basicAuthAuthenticated: boolean;
  isOpened: boolean;
  isLoading: boolean;
}

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const App = ({
  keycloakAuthenticated,
  isKeycloakEnabled,
  keycloak,
  isAppReady,
  basicAuthAuthenticated,
  isOpened: isChatOpened,
  isLoading,
}: IPrivateProps) => {
  const classes = useStyles();
  const [authChecked, setAuthChecked] = React.useState(true);

  const { search } = useLocation();
  React.useEffect(() => {
    runSagaMiddleware();
    const queryStrings = Parser.getQueryStrings(search);
    if (queryStrings.apiUrl) {
      setApiUrlQuery(decodeURIComponent(queryStrings.apiUrl));
    }
    if (queryStrings.readOnly) {
      setReadOnlyQuery(decodeURIComponent(queryStrings.readOnly));
    }
    SystemActionDispatchers.appReady();
    authenticationActionDispatchers.checkAuthenticationAction();
  }, []);

  const refreshToken = async () => {
    if (!keycloak) {
      return;
    }
    authenticationActionDispatchers.keycloakRefreshTokenAction(keycloak);
    await sleep(240000).then(() => refreshToken());
  };

  const initKeycloak = async () => {
    if (!keycloak || !keycloak?.init) {
      return;
    }

    await kcHelper.initKeycloak(keycloak);
  };

  React.useEffect(() => {
    if (isKeycloakEnabled && !keycloakAuthenticated) {
      if (!keycloak.authenticated) {
        initKeycloak();
        setAuthChecked(true);
      }
    }
  }, [isKeycloakEnabled, keycloakAuthenticated, keycloak]);

  React.useEffect(() => {
    if (isKeycloakEnabled && keycloakAuthenticated) {
      refreshToken();
      setAuthChecked(true);
    }
  }, []);

  const authenticated = keycloakAuthenticated && basicAuthAuthenticated;

  useChangeBodyMaxWidth(isChatOpened);

  if (isKeycloakEnabled && !authChecked) {
    return (
      <div className={classes.loadingWrapper}>
        <ClimbingBoxLoader loading color="white" />
      </div>
    );
  }
  return (
    <>
      <div className={`ui container ${isChatOpened ? 'with-chat' : null}`}>
        {isAppReady && (
          <div className="inner-container">
            {!authenticated && (
              <div>{'You need to login to see this page'}</div>
            )}
            {authenticated && (
              <Routes>
                <Route path={MANAGE} element={<Dashboard />} />
                <Route path={PACKAGES} element={<PackagePage />} />
                <Route path={CONVERSATIONS} element={<ConversationsPage />} />
                <Route path={RESOURCES} element={<ExtensionsPage />} />
                <Route path={BOT_VIEW} element={<BotViewPage />} />
                <Route
                  path={CONVERSATION_VIEW}
                  element={<BotConversationViewPage />}
                />
                <Route path={PACKAGE_VIEW} element={<PackageViewPage />} />
                <Route path={MANAGE} />
                <Route path="/" element={<Dashboard />} />
              </Routes>
            )}
            {keycloakAuthenticated && <ModalComponentFrame />}
          </div>
        )}
      </div>
      <Chat />
      {isLoading && <Loader />}
    </>
  );
};

const ComposedApp: React.ComponentClass<{}, IPrivateProps> = compose<
  IPrivateProps,
  undefined
>(
  pure,
  connect(authenticationSelector),
  connect(isAppReadySelector),
  connect(isChatOpenedSelector),
  connect(isLoadingSelector),
  setDisplayName('App'),
)(App);

export default ComposedApp;
