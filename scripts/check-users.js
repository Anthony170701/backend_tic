import { Op, fn, col } from "sequelize";
import { User } from "../models/UserModel.js";
import { Order } from "../models/OrderModel.js";
import { SchoolStudent } from "../models/SchoolStudentModel.js";
import { sequelize } from "../db/conexion.js";

const checkStats = async () => {
  try {
    await sequelize.authenticate();
    
    console.log("1. Counting users...");
    const totalUsers = await User.count();
    console.log("totalUsers:", totalUsers);

    console.log("2. Counting active students...");
    const activeStudents = await SchoolStudent.count().catch((err) => {
      console.warn("SchoolStudent.count failed:", err.message);
      return 0;
    });
    console.log("activeStudents:", activeStudents);

    console.log("3. Counting orders this month...");
    const totalOrdersMonth = await Order.count();
    console.log("totalOrdersMonth:", totalOrdersMonth);

    console.log("4. Finding income this month...");
    const monthIncomeRow = await Order.findOne({
      where: {
        status: "ENTREGADO",
      },
      attributes: [[fn("SUM", col("total")), "income"]],
      raw: true,
    });
    console.log("monthIncomeRow:", monthIncomeRow);

    console.log("✅ Stats test passed successfully!");
  } catch (e) {
    console.error("❌ Stats test failed:", e);
  } finally {
    process.exit(0);
  }
};

checkStats();
