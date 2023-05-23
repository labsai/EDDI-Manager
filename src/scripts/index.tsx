import * as React from 'react';
import '../styles/base.scss';
import { render } from 'react-dom';
import App from './components/App';
import { Provider } from 'react-redux';
import { Router, Route } from 'react-router-dom';
import { persistor, store } from './store/store';
import { history } from './history';
import { PersistGate } from 'redux-persist/integration/react';
import { ConsentBanner, ConsentProvider, ConsentOptions, useConsent } from 'react-hook-consent';
// styling
import 'react-hook-consent/dist/styles/style.css';








const consentOptions: ConsentOptions = {
  services: [
    {
      id: 'eddi-google-analytics',
      name: 'Google Analytics',
      scripts: [
        { id: 'external-script', src: 'https://www.google-analytics.com/analytics.js' },
      ],
      cookies: [{ pattern: 'cookie-name' }],
      mandatory: false,
      description: "We may allow third party service providers to use cookies or similar technologies to collect information about your browsing activities over time and across different websites following your use of the Services. For example, we use Google Analytics, an online analytics service operated by Google LLC(Google Analytics). Google Analytics uses cookies to help us analyze traffic on the Site and enhance your experience when you use the Services. For more information on how Google LLC uses this data, go to https://policies.google.com/privacy",
    },
    {
      id: 'eddi-google-tag-manager',
      name: 'Google Tag Manager',
      scripts: [
        { id: 'external-script', src: 'https://cdn.jsdelivr.net/gh/labsai/EDDI-Manager-Dist@1.0.1/vendor/gtag.js' },
      ],
      cookies: [{ pattern: 'cookie-name' }],
      mandatory: false,
      description: "Google Tag Manager is a tag management system (TMS) that allows us to quickly and easily update measurement codes and related code fragments collectively known as tags on your website or mobile app. Google Tag Manager gives us the ability to add and update your own tags for conversion tracking, site analytics, remarketing, and more. For more information on how Google LLC uses this data, go to https://policies.google.com/privacy",
    },
  ],
  theme: 'dark',
}

render(
  <ConsentProvider
    options={consentOptions}
  >
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Router history={history}>
          <Route component={App} />
          <ConsentBanner />
        </Router>
      </PersistGate>
    </Provider>
  </ConsentProvider>,
  document.getElementById('root'),
);
