import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { transferir } from "./controller.js";

const router = Router();

router.post("/", authRequired, transferir);

export default router;
