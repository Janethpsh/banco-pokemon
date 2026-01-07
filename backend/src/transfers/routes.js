// backend/src/transfers/routes.js
import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { transferir } from "./controller.js";

const router = Router();

// POST /transfers
router.post("/", authRequired, transferir);

export default router;
