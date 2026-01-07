// backend/src/beneficiaries/routes.js
import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { listar, crear, eliminar } from "./controller.js";

const router = Router();

router.get("/", authRequired, listar);
router.post("/", authRequired, crear);

// ✅ borrar favorito por id del registro en beneficiarios
router.delete("/:id", authRequired, eliminar);

export default router;
