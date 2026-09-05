import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import { MoonPayProvider } from "@moonpay/moonpay-react";
import App from "./App.jsx";
import { PRIVY_APP_ID, privyConfig } from "./privyConfig.js";
import { MOONPAY_API_KEY } from "./moonpayConfig.js";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <MoonPayProvider apiKey={MOONPAY_API_KEY} debug={false}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MoonPayProvider>
    </PrivyProvider>
  </StrictMode>
);
