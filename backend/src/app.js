import express from "express";
import cors from "cors";

import authRoutes from "./auth/routes.js";
import accountRoutes from "./account/routes.js";
import beneficiariesRoutes from "./beneficiaries/routes.js";
import transfersRoutes from "./transfers/routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Rutas existentes
app.use("/auth", authRoutes);
app.use("/account", accountRoutes);
app.use("/beneficiaries", beneficiariesRoutes);
app.use("/transfers", transfersRoutes);

export default app;
