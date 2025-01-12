const router = require("express").Router();
const { User, validate } = require("../modules/user");
const bcrypt = require("bcrypt");
const Token = require("../modules/token");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
router.post("/", async (req, res) => {
  try {
    const { error } = validate(req.body);
    if (error) {
      return res.status(400).send({ message: error.details[0].message });
    }

    let user = await User.findOne({ email: req.body.email });

    if (user) {
      return res.status(409).send({ message: "user is already exist!" });
    }
    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);
    user = await new User({ ...req.body, password: hashPassword }).save();
    const token = new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString("hex"),
    });

    try {
      await token.save();
    } catch (err) {
      console.log(err);
    }
    const url = `${process.env.BASE_URL}users/${user._id}/verify/${token.token}`;
    await sendEmail(user.email, "Verify Email", url);
    res
      .status(201)
      .send({ message: "An Email sent to your account please verify" });
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

router.get("/:id/verify/:token", async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id });
    if (!user) {
      return res.status(400).send({ message: "Invalid link" });
    }
    const token = await Token.findOne({
      userId: user._id,
      token: req.params.token,
    });
    if (!token) {
      return res.status(400).send({ message: "Invalid link" });
    }
    if (user.verified) {
      return res.status(400).send({ message: "Email already verified" });
    }
    await User.updateOne({ _id: user._id }, { verified: true });
    await token.remove();
    res.status(200).send({ message: "Email verified" });
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
});

module.exports = router;
