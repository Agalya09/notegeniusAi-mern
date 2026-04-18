/* eslint-disable react-refresh/only-export-components */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Login from "./login";
import Signup from "./signup";
import "./index.css";

const user = localStorage.getItem("user");
const params = new URLSearchParams(window.location.search);
const page = params.get("page");

let Screen = App;

if (!user) {
  Screen = page === "login" ? Login : Signup;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Screen />
  </React.StrictMode>
);