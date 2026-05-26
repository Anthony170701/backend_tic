import { descriptionSystem } from "./prompts/generate_description/descriptionSystem.js";
import { descriptionUser } from "./prompts/generate_description/descriptionUser.js";
import { descriptionDishSystem } from "./prompts/generate_dish_description/descriptionDishSystem.js";
import { descriptionDishUser } from "./prompts/generate_dish_description/descriptionDishUser.js";

export const MOD_HANDLERS = {
  generate_description: {
    system: descriptionSystem,
    user: descriptionUser,
    tokens:600,
  },
  generate_dish_description : {
    system: descriptionDishSystem,
    user: descriptionDishUser,
    tokens: 500,
  }
};
