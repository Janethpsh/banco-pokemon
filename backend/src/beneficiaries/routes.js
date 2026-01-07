import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { listar, crear, eliminar } from "./controller.js";

const router = Router();

router.get("/", authRequired, listar);
router.post("/", authRequired, crear);

// Para borrar un favorito
router.delete("/:id", authRequired, eliminar);

export default router;
