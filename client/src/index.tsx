import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import reportWebVitals from './reportWebVitals';

// /widget is the embeddable chat (iframe on tractorjunction.com); everything else is the full-page app.
// Separate lazy chunks keep the widget free of the full app's global CSS (imported by App) and code.
const isWidget = window.location.pathname.startsWith('/widget');
const App = React.lazy(() => import('./App'));
const WidgetApp = React.lazy(() => import('./widget/WidgetApp'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Suspense fallback={null}>
      {isWidget ? <WidgetApp /> : <App />}
    </Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
