import * as React from 'react';
import '../styles/base.scss';
import { render } from 'react-dom';
import App from './components/App';
import { Provider } from 'react-redux';
import { Router, Route } from 'react-router-dom';
import { persistor, store } from './store/store';
import { history } from './history';
import { PersistGate } from 'redux-persist/integration/react';
import { ConsentProvider } from 'react-hook-consent';



render(
  <ConsentProvider
    options={{
      services: [
        {
          id: 'eddi',
          name: 'MyName',
          scripts: [
            { id: 'external-script', src: 'https://myscript.com/script.js' },
            { id: 'inline-code', code: `alert("I am a JavaScript code");` },
          ],
          cookies: [{ pattern: 'cookie-name' }],
          mandatory: true,
        },
      ],
      theme: 'dark',
    }}
  >
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <Router history={history}>
        <Route component={App} />
      </Router>
    </PersistGate>
  </Provider>
  </ConsentProvider>
  ,
  document.getElementById('root'),
);
