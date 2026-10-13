const express = require("express");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, enrollmentNumber, email, branch, semester } = req.body;

    const fields = [name, enrollmentNumber, email, branch];

    if (
      fields.some(
        (value) => typeof value !== "string" || !value.trim()
      ) ||
      !Number.isInteger(semester) ||
      semester < 1 ||
      semester > 8
    ) {
      return res.status(400).json({
        message: "All fields are required; semester must be an integer from 1 to 8",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email",
      });
    }

    const student = await Student.create({
      name: name.trim(),
      enrollmentNumber: enrollmentNumber.trim().toUpperCase(),
      email: normalizedEmail,
      branch: branch.trim(),
      semester,
    });

    return res.status(201).json({
      message: "Student added successfully",
      student,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Enrollment number already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Add student failed:", error.message);

    return res.status(500).json({
      message: "Could not add student",
    });
  }
});

router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });

    return res.status(200).json({
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Fetch students failed:", error.message);

    return res.status(500).json({
      message: "Could not fetch students",
    });
  }
});


router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    const { name, enrollmentNumber, email, branch, semester } = req.body;
    const fields = [name, enrollmentNumber, email, branch];

    if (
      fields.some(
        (value) => typeof value !== "string" || !value.trim()
      ) ||
      !Number.isInteger(semester) ||
      semester < 1 ||
      semester > 8
    ) {
      return res.status(400).json({
        message: "All fields are required; semester must be an integer from 1 to 8",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email",
      });
    }

    const student = await Student.findByIdAndUpdate(
      id,
      {
        $set: {
          name: name.trim(),
          enrollmentNumber: enrollmentNumber.trim().toUpperCase(),
          email: normalizedEmail,
          branch: branch.trim(),
          semester,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student updated successfully",
      student,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Enrollment number already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Update student failed:", error.message);

    return res.status(500).json({
      message: "Could not update student",
    });
  }
});


router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Delete student failed:", error.message);

    return res.status(500).json({
      message: "Could not delete student",
    });
  }
});
module.exports = router;