const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticatePage = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.redirect('/login');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.redirect('/login');
    }
    req.user = user;
    next();
  } catch (error) {
    return res.redirect('/login');
  }
};

const isAdminPage = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.redirect('/');
  }
  next();
};

module.exports = { authenticatePage, isAdminPage };
