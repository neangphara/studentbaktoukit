//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('connect-flash');
const { SchemaType } = require('mongoose');
const { Schema } = require('mongoose');
const moment = require('moment');
const methodOverride = require('method-override');
const cors = require("cors");
const multer = require("multer");
const xlsx = require('xlsx');
const path = require("path");
const {JSDOM} = require('jsdom');
const {Workbook} = require('exceljs');

const puppeteer = require('puppeteer');
const { request } = require('http');

const port = process.env.PORT || 3000

// Create a new JSDOM instance
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

// Extract the document object from the JSDOM instance
const { document } = dom.window;

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(methodOverride('_method'));
app.use(cors());

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());



mongoose.connect("mongodb+srv://neangphara:johanliebert@cluster0.pvsidip.mongodb.net/baktoukitDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema ({
  username: String,
  password: String,
  branch: String,
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer']
   
  }
});

const studentSchema = new mongoose.Schema ({
  studentID: Number,
  khmername: String,
  englishname: String,
  phone: String,
  gender: String,
  dateofbirth: Date,
  skill: String,
  course: String,
  dateregister: Date,
  price: Number,
  payment: String,
  occupation: String,
  status: String,
  branch: String
});

const departmentSchema = new mongoose.Schema ({
  name: String
});

const courseSchema = new mongoose.Schema ({
  department: String,
  coursename: String,
  price: Number
});

const genderlist = ['ប្រុស', 'ស្រី', 'ព្រះសង្ឈ'];
const skillList = ['រដ្ឋបាលកុំព្យូទ័រ', 'គណនេយ្យកុំព្យូទ័រ', 'ឌីសាញ', 'បច្ចេកទេសកុំព្យូទ័រ'];
const courseLists = ['OAP', 'CAMT', 'Advance Excel', 'Quickbooks', 'Graphic Design','Photoshop', 'Illustrator', 'CorelDraw', 'Premiere Pro', 'After Effects', 'Cinema 4D', 'Web Development', 'AutoCAD'];
const paymentList = ['សាច់ប្រាក់', 'តាមធនាគារ'];
const jobList = ['សិស្ស', 'មានកាងារធ្វើ', 'ផ្សេងៗ'];
const statusList = ['កំពុងសិក្សា', 'បញ្ចប់ការសិក្សា', 'បោះបង់ការសិក្សា'];

const User = new mongoose.model("User", userSchema);
const Student = new mongoose.model("Student", studentSchema);
const Course = new mongoose.model("Course", courseSchema);
const DepartmentList = new mongoose.model("Department", departmentSchema);


app.locals.moment = require('moment');

app.get("/", function(req, res){
  res.render("login");
});



app.get("/login", function(req, res){
  res.render("login");
});

// Create default admin user if it doesn't exist
const createDefaultAdmin = async () => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      const newAdminUser = new User({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      await newAdminUser.save();
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Failed to create default admin user', error);
  }
};

createDefaultAdmin();

// app.get("/register", function(req, res){
//   res.render("register");
// });

app.get("/profile", async(req, res) => {
   // Check if user is logged in
   if (!req.session.user) {
    res.redirect("/login");
  } else {
    const pageTitle = "ប្រ៉ូហ្វាល";
    const userRole = req.session.user.role;
    const { userId } = req.session.user;
    const user = await User.findById(userId);
    const currentUser = user.username;
    const currentUserRole = user.role;
    const currentBranch = user.branch;

    res.render("profile",{
      title: pageTitle,
      currentUser: currentUser,
      currentUserRole: currentUserRole,
      userRole: userRole,
      userBranch: currentBranch
    });
  }
  
});

app.post('/updateUsername', async (req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    const { userId } = req.session.user;
    const newUsername = req.body.username;
    try {
      // Check if the new username is already taken
      const existingUser = await User.findOne({ username: newUsername });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      // Update the username for the logged-in user
      await User.findByIdAndUpdate(userId, { username: newUsername });

      res.status(200).json({ message: 'Username changed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change username' });
    }
  }
});

// Change password route
app.post('/change-password', async (req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  }

  const { currentPassword, newPassword } = req.body;
  const { userId } = req.session.user;

  try {
    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare the provided current password with the stored hashed password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.get("/dashboard", async(req, res) =>{
  // Check if user is logged in and has the admin role
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    const pageTitle = "ផ្ទាំងដើម";
    const userRole = req.session.user.role;
    const countCurrent = await Student.find({
      status: 'កំពុងសិក្សា'
    }).countDocuments();
    const countExam = await Student.find({
      status: 'បញ្ចប់ការសិក្សា'
    }).countDocuments();
    const countDropout = await Student.find({
      status: 'បោះបង់ការសិក្សា'
    }).countDocuments();

    const limit = 4;
    const studentRecent = await Student.find({status: 'កំពុងសិក្សា'}).sort({dateregister: -1, studentID: -1}).limit(limit * 1);
    
    res.render("dashboard", {
      countCurrent: countCurrent, 
      countExam: countExam,
      countDropout: countDropout,
      title: pageTitle,
      recent: studentRecent,
      userRole: userRole
      
    });
  }
    
  
});

app.get("/searchStudent", async(req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    try {
      const userRole = req.session.user.role;
      
      var search = '';
      if(req.query.search){
        search = req.query.search;
      } 
      var page = 1;
      if(req.query.page){
        page = req.query.page;
      }
      const limit = 8;
      
      const searchPattern = isNaN(search) ? {$regex: '.*'+search+'.*', $options: 'i'} : search;
      const query = {
        $or: [
          { khmername: searchPattern },
          { englishname: searchPattern },
          { course: searchPattern },
          { status: searchPattern }
        ]
      };
      
      // Check if the search term is a number
      if (!isNaN(search)) {
        query.$or.push({ studentID: search });
      }

      const foundStudents = await Student.find(query)
      .sort({dateregister: -1, studentID: -1})
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

      const count = await Student.find(query).countDocuments();
      const findCourse = await Course.find();
      const department = await DepartmentList.find();
      const pageTitle = "បញ្ជីសិក្ខាកាម";
      
      res.render('searchStudent', {
        newListStudents: foundStudents,
        totalPage: Math.ceil(count/limit),
        currentPage: page,
        search: search,
        countStudent: count,
        title: pageTitle,
        genderList: genderlist, 
        skillList: skillList, 
        courseLists: findCourse, 
        departmentlist: department,
        paymentList: paymentList, 
        jobList: jobList, 
        statusList: statusList,
        userRole: userRole,
        messageSuccess: req.flash('message-success'),
        messageFail: req.flash('message-fail'),
        messageDelete: req.flash('message-delete')
        
      });

     

    } catch (error) {
      console.log(error.message);
    }
  }
  
});

app.get("/studentList", async(req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    try {
      var search = '';
      if(req.query.search){
        search = req.query.search;
      }
      var page = 1;
      if(req.query.page){
        page = req.query.page;
      }
      const limit = 6;
      
      const searchPattern = isNaN(search) ? {$regex: '.*'+search+'.*', $options: 'i'} : search;
      const query = {
        $or: [
          { khmername: searchPattern },
          { englishname: searchPattern },
          { course: searchPattern }
        ]
      };
      
      // Check if the search term is a number
      if (!isNaN(search)) {
        query.$or.push({ studentID: search });
      }

      const foundStudents = await Student.find()
      .sort({dateregister: -1, studentID: -1})
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

      const count = await Student.find().countDocuments();
      const findCourse = await Course.find();
      const department = await DepartmentList.find();
      const pageTitle = "បញ្ជីសិក្ខាកាម";
      const userRole = req.session.user.role;
      res.render('studentList', {
        newListStudents: foundStudents,
        totalPage: Math.ceil(count/limit),
        currentPage: page,
        search: search,
        countStudent: count,
        title: pageTitle,
        genderList: genderlist, 
        skillList: skillList, 
        courseLists: findCourse, 
        departmentlist: department,
        paymentList: paymentList, 
        jobList: jobList, 
        statusList: statusList,
        userRole: userRole,
        messageSuccess: req.flash('message-success'),
        messageFail: req.flash('message-fail'),
        messageDelete: req.flash('message-delete')
        
        
      });

    } catch (error) {
      console.log(error.message);
    }
  }
  
});

app.get("/currentStudent", async(req, res) =>{
 // Check if user is logged in
 if (!req.session.user) {
  res.redirect("/login");
} else {
  try {
    var search = '';
    if(req.query.search){
      search = req.query.search;
    }
    var page = 1;
    if(req.query.page){
      page = req.query.page;
    }
    const limit = 6;
    

    const foundStudents = await Student.find({
        status: 'កំពុងសិក្សា'
    })
    .sort({dateregister: -1, studentID: -1})
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const count = await Student.find({
        status: 'កំពុងសិក្សា'
      
    }).countDocuments();
    const findCourse = await Course.find();
    const department = await DepartmentList.find();
    const pageTitle = "បញ្ជីសិក្ខាកាមកំពុងទទួលការបណ្តុះបណ្តាល";
    const userRole = req.session.user.role;
    res.render('currentStudent', {
      newListStudents: foundStudents,
      totalPage: Math.ceil(count/limit),
      currentPage: page,
      search: search,
      countStudent: count,
      title: pageTitle,
      genderList: genderlist, 
      skillList: skillList, 
      courseLists: findCourse, 
      departmentlist: department,
      paymentList: paymentList, 
      jobList: jobList, 
      statusList: statusList,
      userRole: userRole,
      messageSuccess: req.flash('message-success'),
      messageFail: req.flash('message-fail'),
      messageDelete: req.flash('message-delete')
    });

  } catch (error) {
    console.log(error.message);
  }
}
    
 
});

app.get("/examList", async (req, res) =>{
 // Check if user is logged in
 if (!req.session.user) {
  res.redirect("/login");
} else {
  try {
    var search = '';
    if(req.query.search){
      search = req.query.search;
    }
    var page = 1;
    if(req.query.page){
      page = req.query.page;
    }
    const limit = 6;
    

    const foundStudents = await Student.find(
        {status: 'បញ្ចប់ការសិក្សា'}
    )
    .sort({dateregister: -1, studentID: -1})
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const count = await Student.find({
      $or:[
        {khmername: {$regex:'.*'+search+'.*', $options:'i'}},
        {englishname: {$regex:'.*'+search+'.*', $options:'i'}},
        {course: {$regex:'.*'+search+'.*', $options:'i'}}
      ],
      $and:[
        {status: 'បញ្ចប់ការសិក្សា'}
      ]
    }).countDocuments();
    const findCourse = await Course.find();
    const department = await DepartmentList.find();
    const pageTitle = "បញ្ជីសិក្ខាកាមបានបញ្ចប់ការបណ្តុះបណ្តាល";
    const userRole = req.session.user.role;
    res.render('examList', {
      newListStudents: foundStudents,
      totalPage: Math.ceil(count/limit),
      currentPage: page,
      search: search,
      countStudent: count,
      title: pageTitle,
      genderList: genderlist, 
      skillList: skillList, 
      courseLists: findCourse, 
      departmentlist: department,
      paymentList: paymentList, 
      jobList: jobList, 
      statusList: statusList,
      userRole: userRole,
      messageSuccess: req.flash('message-success'),
      messageFail: req.flash('message-fail'),
      messageDelete: req.flash('message-delete')
    });

  } catch (error) {
    console.log(error.message);
  }
}
    

});

app.get("/dropout", async (req, res) =>{
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    try {
      var search = '';
      if(req.query.search){
        search = req.query.search;
      }
      var page = 1;
      if(req.query.page){
        page = req.query.page;
      }
      const limit = 6;
      

      const foundStudents = await Student.find({
          status: 'បោះបង់ការសិក្សា'
      })
      .sort({dateregister: -1, studentID: -1})
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

      const count = await Student.find({
        $or:[
          {khmername: {$regex:'.*'+search+'.*', $options:'i'}},
          {englishname: {$regex:'.*'+search+'.*', $options:'i'}},
          {course: {$regex:'.*'+search+'.*', $options:'i'}}
        ],
        $and:[
          {status: 'បោះបង់ការសិក្សា'}
        ]
      }).countDocuments();
      const findCourse = await Course.find();
      const department = await DepartmentList.find();
      const pageTitle = "បញ្ជីសិក្ខាកាមបានបោះបង់ការសិក្សា";
      const userRole = req.session.user.role;
      res.render('dropout', {
        newListStudents: foundStudents,
        totalPage: Math.ceil(count/limit),
        currentPage: page,
        countStudent: count,
        search: search,
        title: pageTitle,
        genderList: genderlist, 
        skillList: skillList, 
        courseLists: findCourse, 
        departmentlist: department,
        paymentList: paymentList, 
        jobList: jobList, 
        statusList: statusList,
        userRole: userRole,
        messageSuccess: req.flash('message-success'),
        messageFail: req.flash('message-fail'),
        messageDelete: req.flash('message-delete')
      });

    } catch (error) {
      console.log(error.message);
    }
  }
    
 
});

app.get("/courseList", async(req, res)=>{
 // Check if user is logged in
 if (!req.session.user) {
  res.redirect("/login");
  } else {
    var page = 1;
      if(req.query.page){
        page = req.query.page;
      }
      const limit = 6;
      const pageTitle = "វគ្គបណ្តុះបណ្តាល";
      const userRole = req.session.user.role;
      const department = await DepartmentList.find();
      const course = await Course.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
      const count = await Course.find().countDocuments();
      res.render('courseList', {
        departmentlist: department,
        newListCourses: course,
        title: pageTitle,
        userRole: userRole,
        totalPage: Math.ceil(count/limit),
        currentPage: page,
        messageSuccess: req.flash('message-success'),
        messageFail: req.flash('message-fail'),
        messageDelete: req.flash('message-delete')
      });
  }
});

app.get("/department", async (req,res) =>{
    // Check if user is logged in
 if (!req.session.user) {
  res.redirect("/login");
  } else {
    var page = 1;
      if(req.query.page){
        page = req.query.page;
      }
      const limit = 6;
      const pageTitle = "ជំនាញ";
      const userRole = req.session.user.role;
      const department = await DepartmentList.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

      const count = await DepartmentList.find().countDocuments();
      
      res.render('department', {
        departmentlist: department,
        title: pageTitle,
        userRole: userRole,
        totalPage: Math.ceil(count/limit),
        currentPage: page,
        messageSuccess: req.flash('message-success'),
        messageFail: req.flash('message-fail'),
        messageDelete: req.flash('message-delete')
      });
  }
});

app.post("/addDepartment", function(req, res){
  const department = new DepartmentList({
    name: req.body.department
  });
  department.save((err) => {
    if(err) {
      console.log(err);
      req.flash('message-danger', 'រក្សាទុកមិនបានជោគជ័យ');
    } else {
      console.log("Data added successfully");
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect("/department");
    }
  });
});

app.post("/addcourse", function(req, res){
  const course = new Course({
    department: req.body.department,
    coursename: req.body.coursename,
    price: req.body.price
  });

  course.save((err) => {
    if(err) {
      console.log(err);
      req.flash('message-danger', 'រក្សាទុកមិនបានជោគជ័យ');
    } else {
      console.log("Data added successfully");
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect("/courseList");
    }
  });
});


app.get("/userList", async(req, res) => {
 // Check if user is logged in and has the admin role
 if (!req.session.user || req.session.user.role !== 'admin') {
  res.redirect("/login");
} else {
    const pageTitle = "បញ្ជីអ្នកប្រើប្រាស់";
    const userRole = req.session.user.role;
    const userBranch = req.session.user.branch;
    const title = pageTitle;
    const { userId } = req.session.user;
    
    try {
      // Retrieve all users fromthe database
      const users = await User.find();
      const currentUser = await User.findById(userId);
  
      res.render('userList', { users, title, currentUser, userRole, userBranch, messageSuccess: req.flash('message-success'),
      messageFail: req.flash('message-fail'),
      messageDelete: req.flash('message-delete') });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve user list' });
    }
}
    
  
});



app.post("/updateUsers", async(req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    const userId = req.body.objectID;
    const newUsername = req.body.username;
    const updatedData = {
      username: req.body.username
    };

    // Check if the new username is already taken
    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    } 
    User.findByIdAndUpdate(userId, updatedData)
        .then(() => {
          console.log('User updated successfully');
          res.redirect('/userList'); // Redirect to the student list page
        })
        .catch((error) => {
          console.error('Error updating User:', error);
          res.redirect('/userList'); // Redirect to the student list page
        });
  }
});

app.post("/updateUsersSetting", async(req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    const userId = req.body.objectID;

    const updatedData = {
      role: req.body.role,
      branch: req.body.branch
    };

    User.findByIdAndUpdate(userId, updatedData)
        .then(() => {
          console.log('User updated successfully');
          res.redirect('/userList'); // Redirect to the student list page
        })
        .catch((error) => {
          console.error('Error updating User:', error);
          res.redirect('/userList'); // Redirect to the student list page
        });
  }
});

app.delete('/deleteAccount/:id', async (req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    const { userId } = req.session.user;
    const accountId = req.params.id;
    
    try {
      const user = await User.findById(userId);


      // Check if the admin is trying to delete their own account or any other logged-in account
      if (accountId === userId || accountId === user._id.toString()) {
        return res.status(400).json({ error: 'Admin cannot delete their own account or any logged-in account' });
      }

      // Proceed with deleting the account
      await User.findByIdAndDelete(accountId);

      res.redirect('/userList')
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete the account' });
    }
  }
});


// Log out a user
app.get('/logout', (req, res) => {
  // Destroy the session and remove user data
  req.session.destroy(err => {
    if (err) {
      console.error('Failed to destroy session', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }

    res.redirect("/login");
  });
});



// Register a new user
app.post('/register', async (req, res) => {
  

  const { username, password, role, branch } = req.body;

  try {
    // Check if the username is already taken
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({ username, password: hashedPassword, role, branch });
    await newUser.save();

    res.redirect("/userList");
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});



// Log in a user
app.post('/login', async (req, res) => {
  

  const { username, password } = req.body;

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Compare the provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Store the user data in the session
    req.session.user = {
      userId: user._id,
      username: user.username,
      role: user.role
    };

    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.post("/addStudent", async (req, res) =>{
  const newStudentID = req.body.studentID;
  const { userId } = req.session.user;
  const user = await User.findById(userId);
  const baktoukBranch = user.branch;
 
  // Check if the new studentID already exists in the database
  Student.findOne({ studentID: newStudentID }, function(err, existingStudent) {
    if (err) {
      console.log(err);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect("/studentList");
    } else if (existingStudent) {
      return res.status(401).json({ error: 'អត្តលេខ ' + newStudentID + ' មានរួចហើយ' });
      // req.flash('message-fail', 'អត្តលេខសិស្សនេះបានប្រើរួចហើយ');
      // res.redirect("/studentList");
    } else {
      // Create a new student object
      const student = new Student({
        studentID: newStudentID,
        khmername: req.body.khmername,
        englishname: req.body.englishname,
        phone: req.body.phone,
        gender: req.body.gender,
        dateofbirth: req.body.dateofbirth,
        skill: req.body.skill,
        course: req.body.course,
        dateregister: req.body.dateregister,
        price: req.body.price,
        payment: req.body.payment,
        occupation: req.body.occupation,
        status: req.body.status,
        branch: baktoukBranch
      });

      // Save the new student
      student.save(function(err) {
        if (err) {
          console.log(err);
          req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
          res.redirect("/studentList");
        } else {
          req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
          res.redirect("/studentList");
        }
      });
    }
  });
});

app.post("/addCurrentStudent", function(req, res){
  const student = new Student({
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    phone: req.body.phone,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status
  });

  const studentID = req.body.studentID;
  // Check if the new studentID is already taken
  const existingID = Student.findOne({ studentID: studentID });
  if (existingID) {
    return res.status(400).json({ error: 'អត្តលេខ ' + studentID + ' មានរួចហើយមិនអាចបញ្ចូលបានទេ' });
  }

  student.save((err) => {
    if(err) {
      console.log(err);
        
        req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
        res.redirect("/currentStudent");
                
    } else {
        req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
        res.redirect("/currentStudent");
               
    }
  });
});

app.post("/addExamList", function(req, res){
  const student = new Student({
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    phone: req.body.phone,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status
  });

  const studentID = req.body.studentID;
  // Check if the new studentID is already taken
  const existingID = Student.findOne({ studentID: studentID });
  if (existingID) {
    return res.status(400).json({ error: 'អត្តលេខ ' + studentID + ' មានរួចហើយមិនអាចបញ្ចូលបានទេ' });
  }

  student.save((err) => {
    if(err) {
      console.log(err);
        
        req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
        res.redirect("/examList");
                
    } else {
        req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
        res.redirect("/examList");
               
    }
  });
});

app.post("/addDropout", function(req, res){
  const student = new Student({
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    phone: req.body.phone,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status
  });

  const studentID = req.body.studentID;
  // Check if the new studentID is already taken
  const existingID = Student.findOne({ studentID: studentID });
  if (existingID) {
    return res.status(400).json({ error: 'អត្តលេខ ' + studentID + ' មានរួចហើយមិនអាចបញ្ចូលបានទេ' });
  }

  student.save((err) => {
    if(err) {
      console.log(err);
        
        req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
        res.redirect("/dropout");
                
    } else {
        req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
        res.redirect("/dropout");
               
    }
  });
});


// DELETE route handler
app.delete('/studentList/:id', (req, res) => {
  const studentId = req.params.id;

  // Use Mongoose to delete the student from the database
  Student.findByIdAndDelete(studentId)
    .then(() => {
      console.log('Student deleted successfully');
      req.flash('message-delete', 'ទិន្នន័យត្រូវបានលុប');
      res.redirect('/studentList');
    })
    .catch((error) => {
      console.error('Error deleting student:', error);
      req.flash('message-delete', 'ទិន្នន័យមិនអាចលុបបានទេ');
      res.redirect('/studentList'); // Redirect to the student list page
    });
});

// DELETE route handler
app.delete('/currentStudent/:id', (req, res) => {
  const studentId = req.params.id;

  // Use Mongoose to delete the student from the database
  Student.findByIdAndDelete(studentId)
    .then(() => {
      console.log('Student deleted successfully');
      req.flash('message-delete', 'ទិន្នន័យត្រូវបានលុប');
      res.redirect('/currentStudent');
    })
    .catch((error) => {
      console.error('Error deleting student:', error);
      req.flash('message-delete', 'ទិន្នន័យមិនអាចលុបបានទេ');
      res.redirect('/currentStudent'); // Redirect to the student list page
    });
});

// DELETE route handler
app.delete('/examList/:id', (req, res) => {
  const studentId = req.params.id;

  // Use Mongoose to delete the student from the database
  Student.findByIdAndDelete(studentId)
    .then(() => {
      console.log('Student deleted successfully');
      req.flash('message-delete', 'ទិន្នន័យត្រូវបានលុប');
      res.redirect('/examList');
    })
    .catch((error) => {
      console.error('Error deleting student:', error);
      req.flash('message-delete', 'ទិន្នន័យមិនអាចលុបបានទេ');
      res.redirect('/examList'); // Redirect to the student list page
    });
});

// DELETE route handler
app.delete('/dropout/:id', (req, res) => {
  const studentId = req.params.id;

  // Use Mongoose to delete the student from the database
  Student.findByIdAndDelete(studentId)
    .then(() => {
      console.log('Student deleted successfully');
      req.flash('message-delete', 'ទិន្នន័យត្រូវបានលុប');
      res.redirect('/dropout');
    })
    .catch((error) => {
      console.error('Error deleting student:', error);
      req.flash('message-delete', 'ទិន្នន័យមិនអាចលុបបានទេ');
      res.redirect('/dropout'); // Redirect to the student list page
    });
});



app.post('/updateStudent', (req, res) => {
  const studentId = req.body.objectID;
  const updatedData = {
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status,
    phone: req.body.phone
  };

  // Use Mongoose to update the student in the database
  Student.findByIdAndUpdate(studentId, updatedData)
    .then(() => {
      console.log('Student updated successfully');
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect('/studentList'); // Redirect to the student list page
    })
    .catch((error) => {
      console.error('Error updating student:', error);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect('/studentList'); // Redirect to the student list page
    });
});

app.post('/updateCurrentStudent', (req, res) => {
  const studentId = req.body.objectID;
  const updatedData = {
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status,
    phone: req.body.phone
  };

  // Use Mongoose to update the student in the database
  Student.findByIdAndUpdate(studentId, updatedData)
    .then(() => {
      console.log('Student updated successfully');
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect('/currentStudent'); // Redirect to the student list page
    })
    .catch((error) => {
      console.error('Error updating student:', error);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect('/currentStudent'); // Redirect to the student list page
    });
});

app.post('/updateExamList', (req, res) => {
  const studentId = req.body.objectID;
  const updatedData = {
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status,
    phone: req.body.phone
  };

  // Use Mongoose to update the student in the database
  Student.findByIdAndUpdate(studentId, updatedData)
    .then(() => {
      console.log('Student updated successfully');
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect('/examList'); // Redirect to the student list page
    })
    .catch((error) => {
      console.error('Error updating student:', error);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect('/examList'); // Redirect to the student list page
    });
});

app.post('/updateDropout', (req, res) => {
  const studentId = req.body.objectID;
  const updatedData = {
    studentID: req.body.studentID,
    khmername: req.body.khmername,
    englishname: req.body.englishname,
    gender: req.body.gender,
    dateofbirth: req.body.dateofbirth,
    skill: req.body.skill,
    course: req.body.course,
    dateregister: req.body.dateregister,
    price: req.body.price,
    payment: req.body.payment,
    occupation: req.body.occupation,
    status: req.body.status,
    phone: req.body.phone
  };

  // Use Mongoose to update the student in the database
  Student.findByIdAndUpdate(studentId, updatedData)
    .then(() => {
      console.log('Student updated successfully');
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect('/dropout'); // Redirect to the student list page
    })
    .catch((error) => {
      console.error('Error updating student:', error);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect('/dropout'); // Redirect to the student list page
    });
});


app.post('/updateCourse', (req, res) => {
  const courseId = req.body.courseID;
  const updatedData = {
    department: req.body.department,
    coursename: req.body.coursename,
    price: req.body.price
  };

  // Use Mongoose to update the student in the database
  Course.findByIdAndUpdate(courseId, updatedData)
    .then(() => {
      console.log('Course updated successfully');
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect('/courseList'); // Redirect to the student list page
    })
    .catch((error) => {
      console.error('Error updating student:', error);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect('/courseList'); // Redirect to the student list page
    });
});

app.post('/updateDepartment', (req, res) => {
  const departmentId = req.body.departmentID;
  const updatedData = {
    department: req.body.department
  };

  // Use Mongoose to update the student in the database
  DepartmentList.findByIdAndUpdate(departmentId, updatedData)
    .then(() => {
      console.log('Department updated successfully');
      req.flash('message-success', 'រក្សាទុកបានជោគជ័យ');
      res.redirect('/department'); // Redirect to the student list page
    })
    .catch((error) => {
      console.error('Error updating department:', error);
      req.flash('message-fail', 'រក្សាទុកមិនបានជោគជ័យ');
      res.redirect('/department'); // Redirect to the student list page
    });
});

// DELETE route handler
app.delete('/courseList/:id', (req, res) => {
  const courseId = req.params.id;

  // Use Mongoose to delete the student from the database
  Course.findByIdAndDelete(courseId)
    .then(() => {
      console.log('Course deleted successfully');
      req.flash('message-delete', 'ទិន្នន័យត្រូវបានលុប');
      res.redirect('/courseList');
    })
    .catch((error) => {
      console.error('Error deleting course:', error);
      req.flash('message-delete', 'ទិន្នន័យមិនអាចលុបបានទេ');
      res.redirect('/courseList'); // Redirect to the student list page
    });
});

// DELETE route handler
app.delete('/department/:id', (req, res) => {
  const departmentId = req.params.id;

  // Use Mongoose to delete the student from the database
  DepartmentList.findByIdAndDelete(departmentId)
    .then(() => {
      console.log('Department deleted successfully');
      req.flash('message-delete', 'ទិន្នន័យត្រូវបានលុប');
      res.redirect('/department');
    })
    .catch((error) => {
      console.error('Error deleting department:', error);
      req.flash('message-delete', 'ទិន្នន័យមិនអាចលុបបានទេ');
      res.redirect('/department'); // Redirect to the student list page
    });
});

//birthday
app.get("/birthday" , async(req, res) => {
    // Check if user is logged in
 if (!req.session.user) {
  res.redirect("/login");
} else {
  try {
    var search = '';
    if(req.query.search){
      search = req.query.search;
    }
    var page = 1;
    if(req.query.page){
      page = req.query.page;
    }
    const limit = 8;
    // Create a query object to store the filter conditions
    const query = {};
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // Adding 1 to get the correct month index
    const currentDay = currentDate.getDate();
    
    // query.dateofbirth = { $eq: `${currentMonth}-${currentDay}` };
    query.$expr = {
      $and: [
        { $eq: [{ $month: "$dateofbirth" }, currentMonth] },
        { $eq: [{ $dayOfMonth: "$dateofbirth" }, currentDay] }
      ]
    };
    

    const foundStudents = await Student.find(query)
    .sort({dateregister: -1, studentID: -1})
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const count = await Student.find(query).countDocuments();
    const pageTitle = "បញ្ជីខួបកំណើតរបស់សិក្ខាកាម";
    const userRole = req.session.user.role;
    res.render('birthday', {
      newListStudents: foundStudents,
      totalPage: Math.ceil(count/limit),
      currentPage: page,
      search: search,
      countStudent: count,
      title: pageTitle,
      genderList: genderlist, 
      skillList: skillList, 
      courseLists: courseLists, 
      paymentList: paymentList, 
      jobList: jobList, 
      statusList: statusList,
      userRole: userRole,
      message: req.flash('message')
    });

  } catch (error) {
    console.log(error.message);
  }
}
});


  app.get("/report", async(req, res) => {
   // Check if user is logged in
   if (!req.session.user) {
    res.redirect("/login");
  } else {
    const pageTitle = "របាយការណ៍";
      const userRole = req.session.user.role;
      var page = 1;
        if(req.query.page){
          page = req.query.page;
        }
        const limit = 10;
    // Retrieve available courses from the database
    const availableCourses = await Student.distinct('course');
    const availableStatus = await Student.distinct('status');
    const availableReport = ["ប្រចាំថ្ងៃ", "ប្រចាំខែ", "ប្រចាំឆ្នាំ"];
    const foundStudents = await Student.find()
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();
    const count = await Student.find().countDocuments();
    const courseParam = "";
    const statusParam = "";
    const reportParam = "";
    const startDateParam = new Date();
    const endDateParam = new Date();

   
    
      res.render('report', {
        foundStudents: foundStudents,
        title: pageTitle,
        availableCourses: availableCourses,
        courseParam: courseParam,
        availableStatus: availableStatus,
        statusParam: statusParam,
        availableReport: availableReport,
        reportParam: reportParam,
        startDateParam: startDateParam,
        endDateParam: endDateParam,
        count: count,
        currentPage: page,
        totalPage: Math.ceil(count/limit),
        userRole: userRole
      });
  }
      
  });

  app.get("/reportFilter", async(req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
      res.redirect("/login");
    } else {
      try {
        
        const pageTitle = "របាយការណ៍";
        const userRole = req.session.user.role;
        // Retrieve available courses from the database
        const availableCourses = await Student.distinct('course');
        const availableStatus = await Student.distinct('status');
        const availableReport = ["ប្រចាំថ្ងៃ", "ប្រចាំខែ", "ប្រចាំឆ្នាំ"];
        // Retrieve the courseParam from the request query
        const courseParam = req.query.course || '';
        const statusParam = req.query.status || '';
        const reportParam = req.query.reportType || '';
        // let startDateParam = req.query.startDateCustom || '';
        // let endDateParam = req.query.endDateCustom || '';
        let startDateParam = req.query.startDateCustom || '';
        let endDateParam = req.query.endDateCustom || '';

        var page = 1;
        if(req.query.page){
          page = req.query.page;
        }
        const limit = 10;


        // Retrieve the filter criteria from the request parameters or body
      const { reportType, course, status, startDateCustom, endDateCustom, next } = req.query;
      
      
      // Create a query object to store the filter conditions
      const query = {};
  
      if(startDateCustom === "" && endDateCustom === ""){
        // Apply the appropriate filters based on the selected date filter
      if (reportType === 'ប្រចាំថ្ងៃ') {
        const currentDate = new Date();
        const startOfDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate()
        );
        const endOfDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1
        );
        query.dateregister = { $gte: startOfDay, $lt: endOfDay };
        
      } else if (reportType === 'ប្រចាំខែ') {
        const currentDate = new Date();
        const startOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        const endOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          1
        );
        query.dateregister = { $gte: startOfMonth, $lt: endOfMonth };
         
         
      } else if (reportType === 'ប្រចាំឆ្នាំ') {
        const currentDate = new Date();
        const startOfYear = new Date(
          currentDate.getFullYear(),
          0,
          1
        );
        const endOfYear = new Date(
          currentDate.getFullYear() + 1,
          0,
          1
        );
        query.dateregister = { $gte: startOfYear, $lt: endOfYear };
       
      }
      } else {
        const startDate = new Date(startDateCustom);
        const endDate = new Date(endDateCustom);
        // Check if the startDate and endDate are valid dates
        if (isNaN(startDate) || isNaN(endDate)) {
          // Handle the case where the provided dates are invalid
          // You can throw an error, send an error response, or take any other appropriate action
          // For example, you can set query.dateregister to null to skip the date filter
          query.dateregister = null;
        } else {
          query.dateregister = { $gte: startDate, $lt: endDate };
        }
      }
  
      // Apply additional filters based on course and status, if provided
      if (course) {
        query.course = course;
      }
      if (status) {
        query.status = status;
      }
      if (course === 'វគ្គសិក្សា') {
        query.course = { $exists: true };
      }
      
      if (status === 'ស្ថានភាព') {
        query.status = { $exists: true };
      }
  
      // Use Mongoose to query your MongoDB collection based on the constructed query
      const foundStudents = await Student.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
      const count = await Student.find(query).countDocuments();

        res.render('report', {
          foundStudents: foundStudents,
          title: pageTitle,
          availableCourses: availableCourses,
          courseParam: courseParam,
          availableStatus: availableStatus,
          statusParam: statusParam,
          availableReport: availableReport,
          reportParam: reportParam,
          startDateParam: startDateParam,
          endDateParam: endDateParam,
          count: count,
          currentPage: page,
          totalPage: Math.ceil(count/limit),
          userRole: userRole
         
        });
      } catch (error) {
        console.log(error.message);
      }
    }
  
  });


  app.post('/exportToExcel', async(req, res) => {
    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet("My students");
      worksheet.columns = [
        { header: "លេខរៀង", key: "no"},
        { header: "អត្តលេខ", key: "studentID"},
        { header: "នាម និងគោត្តនាម", key: "khmername"},
        { header: "ជាអក្សរឡាតាំង", key: "englishname"},
        { header: "ភេទ", key: "gender"},
        { header: "ថ្ងៃខែឆ្នាំកំណើត", key: "dateofbirth"},
        { header: "ជំនាញ", key: "skill"},
        { header: "វគ្គសិក្សា", key: "course"},
        { header: "ថ្ងៃចុះឈ្មោះ", key: "dateregister"},
        { header: "តម្លៃសិក្សា", key: "price"},
        { header: "ការទូទាត់", key: "payment"},
        { header: "មុខរបរ", key: "occupation"},
        { header: "ស្ថានភាព", key: "status"}
        
      ];
      let counter = 1;
      const query = {};
      const exportbyReportType = req.body.byReport;
      const currentDate = new Date();
      if(exportbyReportType === 'ប្រចាំថ្ងៃ') {
        exportbyStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate()
        );
        exportbyEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1
        );
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
      } else if(exportbyReportType === 'ប្រចាំខែ') {
        exportbyStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        exportbyEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          1
        );
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
      } else if(exportbyReportType === 'ប្រចាំឆ្នាំ') {
        exportbyStartDate = new Date(
          currentDate.getFullYear(),
          0,
          1
        );
        exportbyEndDate = new Date(
          currentDate.getFullYear() + 1,
          0,
          1
        );
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
      
      } else {
        exportbyStartDate = req.body.byStartDate;
        exportbyEndDate = req.body.byEndDate;
        
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
      } 
      
      
      if(req.body.byCourse === 'វគ្គសិក្សា' ) {
        query.course = { $exists: true };
      } else {
        const exportbyCourse = req.body.byCourse;
        query.course = exportbyCourse;
        if((exportbyReportType === 'របាយការណ៍' )){
          exportbyStartDate = req.body.byStartDate;
          exportbyEndDate = req.body.byEndDate;
          if(exportbyStartDate === '' || exportbyEndDate === ''){
            query.dateregister = { $exists: true };
          } else {
            query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
          }
          
        }
      }

      if(req.body.byStatus === 'ស្ថានភាព') {
        query.status = { $exists: true };
      } else {
        const exportbyStatus = req.body.byStatus;
        query.status = exportbyStatus;
        if((exportbyReportType === 'របាយការណ៍' )){
          exportbyStartDate = req.body.byStartDate;
          exportbyEndDate = req.body.byEndDate;
          
          if(exportbyStartDate === '' || exportbyEndDate === ''){
            query.dateregister = { $exists: true };
          } else {
            query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
          }
        }
      }

      

      const foundStudents = await Student.find(query);
      foundStudents.forEach((student) => {
        student.no = counter;
        worksheet.addRow(student);
        counter++;
      });
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = {bold:true};
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheatml.sheet"
      );
      res.setHeader("Content-Disposition", `attactment; filename=students.xlsx`);
      return workbook.xlsx.write(res).then(()=>{
        res.status(200);
      });
    } catch (error) {
      console.log(error.message);
    }
    
  });


  app.post('/pdfmaker', async (req, res) => {
    
    let setTitle = ''
    const query = {};
      const exportbyReportType = req.body.byReport;
      const currentDate = new Date();
      if(exportbyReportType === 'ប្រចាំថ្ងៃ') {
        exportbyStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate()
        );
        exportbyEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1
        );
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
        setTitle = "តារាងបញ្ជីរាយនាមសិស្សចុះឈ្មោះចូលរៀន ប្រចាំថ្ងៃ";
      } else if(exportbyReportType === 'ប្រចាំខែ') {
        exportbyStartDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        exportbyEndDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          1
        );
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
        const currentMonth = exportbyStartDate.getMonth() + 1;
        const khmerMonth = formatKhmerMonth(currentMonth);
         setTitle = "តារាងបញ្ជីរាយនាមសិស្សចុះឈ្មោះចូលរៀន សម្រាប់ខែ " + khmerMonth + " ឆ្នាំ២០២៣";
      } else if(exportbyReportType === 'ប្រចាំឆ្នាំ') {
        exportbyStartDate = new Date(
          currentDate.getFullYear(),
          0,
          1
        );
        exportbyEndDate = new Date(
          currentDate.getFullYear() + 1,
          0,
          1
        );
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
        const currentYear = exportbyStartDate.getFullYear();
        const khmerNumber = formatKhmerNumber(currentYear);
        setTitle = "តារាងបញ្ជីរាយនាមសិស្សចុះឈ្មោះចូលរៀន ប្រចាំឆ្នាំ " + khmerNumber;
      } else {
        exportbyStartDate = req.body.byStartDate;
        exportbyEndDate = req.body.byEndDate;
        
        query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
        const currentDate = new Date(exportbyStartDate);
        const currentMonth = currentDate.getMonth() + 1;
        const khmerMonth = formatKhmerMonth(currentMonth);
        console.log(currentMonth);
         setTitle = "តារាងបញ្ជីរាយនាមសិស្សចុះឈ្មោះចូលរៀន សម្រាប់ខែ " + khmerMonth + " ឆ្នាំ២០២៣";
      } 
      
      if(req.body.byCourse === 'វគ្គសិក្សា' ) {
        query.course = { $exists: true };
      } else {
        const exportbyCourse = req.body.byCourse;
        query.course = exportbyCourse;
        setTitle = "តារាងបញ្ជីរាយនាមសិស្សចុះឈ្មោះចូលរៀនតាមវគ្គ " + exportbyCourse;
        if((exportbyReportType === 'របាយការណ៍' )){
          exportbyStartDate = req.body.byStartDate;
          exportbyEndDate = req.body.byEndDate;
          
          if(exportbyStartDate === '' || exportbyEndDate === ''){
            query.dateregister = { $exists: true };
          } else {
            query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
          }
        }
      }

      if(req.body.byStatus === 'ស្ថានភាព') {
        query.status = { $exists: true };
      } else {
        const exportbyStatus = req.body.byStatus;
        query.status = exportbyStatus;
        setTitle = "តារាងបញ្ជីរាយនាមសិស្ស" + exportbyStatus;
        if((exportbyReportType === 'របាយការណ៍' )){
          exportbyStartDate = req.body.byStartDate;
          exportbyEndDate = req.body.byEndDate;
          
          if(exportbyStartDate === '' || exportbyEndDate === ''){
            query.dateregister = { $exists: true };
          } else {
            query.dateregister = {$gte: exportbyStartDate, $lt: exportbyEndDate};
          }
        }
      }

      const data = await Student.find(query);
    const template = `
    <!DOCTYPE html>
<html>
<head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@200;500&family=Moul&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Kantumruy+Pro:wght@200;500&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-4bw+/aepP/YC94hEpVNVgiZdgIC5+VKNBQNGCHeKRQN+PtmoHDEXuppvnDJzQIu9" crossorigin="anonymous">

    <title>HTML content</title>
    <style>
        body {
          line-height: 1.5;
        }
        .fontMuol {
            font-family: 'Moul', cursive;
        }
        .fontBattambang {
            font-family: 'Battambang', cursive;
        }
        .fontbold {
            font-weight: 900;
        }
        .center {
            text-align: center;
        }
        .left {
            text-align: left;
        }
        .right {
            text-align: right;
        }
        p{
            margin: 4px;
        }
        table, td, th {
            border: 1px solid;
            padding: 2px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table, th {
            font-family: 'Battambang', cursive;
            
            text-align: center;
        }
        .table-header {
          display: table-header-group;
          break-inside: avoid;
        }
        @font-face {
          font-family: 'tacteing';
          src: url('./font/TACTENG.TTF') format('truetype');
        }
        .fontTacteing {
          font-family: 'tacteing';
          font-size: 28px;
        }
    </style>
</head>
<body>


    <p class="fontMuol center">ព្រះរាជាណាចក្រកម្ពុជា</p>
    <p class="fontMuol center">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
    <p class="fontTacteing center">3</p>
    <div style="float: left;">
        <p class="fontMuol left">មជ្ឈមណ្ឌលពត៌មានវិទ្យាបាក់ទូក</p>
        <p class="fontBattambang">សាខាខេត្តព្រះសីហនុ</p>
    </div>
    <div style="float: right;">
        <p class="fontBattambang right fontbold">ទំនាក់ទំនង៖ ០១៥ ៥១១​ ១០០</p>
        <p class="fontBattambang right">អាសយដ្ឋាន៖ ផ្ទះលេខ២៦ ផ្លូវ២២០ សង្កាត់លេខ៤  ក្រុងព្រះសីហនុ</p>
    </div>
    
    <div style="clear: both;"><p class="fontMuol center"> <%= setTitle %> </p></div>
    <div>
        <table>
            <thead class="table-header">
                <tr>
                    <th scope="col">លេខរៀង</th>
                    <th scope="col">ឈ្មោះ</th>
                    <th scope="col">ជាអក្សរឡាតាំង</th>
                    <th scope="col">ភេទ</th>
                    <th scope="col">ឆ្នាំកំណើត</th>
                    <th scope="col">ជំនាញ</th>
                    <th scope="col">វគ្គសិក្សា</th>
                    <th scope="col">ថ្ងៃចុះឈ្មោះ</th>
                    <th scope="col">តម្លៃ</th>
                    <th scope="col">ការទូទាត់</th>
                    <th scope="col">មុខរបរ</th>
                    <th scope="col">ស្ថានភាព</th>
                    <th scope="col">ទីតាំង</th>
                </tr>
            </thead>
            <tbody>
                
                <% data.forEach(function(student, index) { %>
                  <% var options = { year: 'numeric', month: 'numeric', day: 'numeric' };
                  var studentDOB = student.dateofbirth;
                  var studentReg = student.dateregister;
                  var price = student.price;
                  var formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
                  
                  %>
                    <tr>
                      <td> <%= index + 1 %> </td>
                      <td style="text-align: left;"> <%= student.khmername %> </td>
                      <td style="text-align: left;"> <%= student.englishname %></td>
                      <td> <%= student.gender %></td>
                      <td style="text-align: right;"><%= studentDOB.toLocaleString('en-US', options); %></td>
                      <td style="text-align: left;"> <%= student.skill %></td>
                      <td style="text-align: left;"> <%= student.course %></td>
                      <td style="text-align: right;"><%= studentReg.toLocaleString('en-US', options); %> </td>
                      <td style="text-align: right;"> <%= formattedPrice %></td>
                      <td style="text-align: left;"> <%= student.payment %></td>
                      <td style="text-align: left;"> <%= student.occupation %></td>
                      <td style="text-align: left;"> <%= student.status %></td>
                      <td style="text-align: left;"> <%= student.branch %></td>
                    </tr>
                <% }) %>
            </tbody>
        </table>
    </div>
    <br>
    <p class="fontBattambang right">ថ្ងៃ............................ខែ..........................ឆ្នាំ..................... ពុទ្ធសករាជ............</p> 
    <p class="fontBattambang right" style="margin-right:40px;">ព្រះសីហនុ ថ្ងៃទី.................ខែ.................ឆ្នាំ....... </p> 
    <p class="fontMuol right" style="margin-right:80px";>នាយកមជ្ឈមណ្ឌលព័ត៌មានវិទ្យាបាក់ទូក</p>

    
    
</body>

</html>
    
    `;

    // Render EJS template with data
    const html = ejs.render(template, { data, setTitle });

      // Create a browser instance
  const browser = await puppeteer.launch();

  // Create a new page
  const page = await browser.newPage();

  

  //Get HTML content from HTML file
  // const html = fs.readFileSync('views/reportPdfcopy.ejs', 'utf-8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // To reflect CSS used for screens instead of print
  await page.emulateMediaType('screen');


  // Downlaod the PDF
  const pdf = await page.pdf({
    path: 'result.pdf',
    margin: { top: '12', right: '12', bottom: '12', left: '12' },
    printBackground: true,
    landscape: true,
    format: 'A4',
  });

  const file = path.join(__dirname, 'result.pdf');
  res.contentType('application/pdf');
  res.download(file, 'students.pdf');
  // Close the browser instance
  await browser.close();
  });


  //import data from excel
  const upload = multer({ dest: 'uploads/' });
  
  

  // Handle the file upload
app.post('/upload', upload.single('excelFile'), (req, res) => {
  const filePath = req.file.path;
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const headers = jsonData[0];
  const rows = jsonData.slice(1);

  // Render the preview template and pass the data
  res.render('preview', { headers: headers, rows: rows });
});


// Create a route to handle table data submission
app.post('/tableData', async (req, res) => {
  try {

  const inputData = req.body; // Input data from the request body
  const newID = req.body.studentID;
  // Check if the new username is already taken
  const existingID = await Student.findOne({ studentID: newID });
  if (existingID) {
    return res.status(400).json({ error: 'សិក្ខាកាមមានអត្តលេខ ' + newID + ' ជាន់គ្នាជាមួយទិន្នន័យនៅក្នុងប្រព័ន្ធ សូមពិនិត្យអត្តលេខឡើងវិញ' });
  }
  const dataObject = {}; // Object to store all input data

  for (const key in inputData) {
    if (inputData.hasOwnProperty(key)) {
      if (Array.isArray(inputData[key])) {
        // If the property is an array, concatenate the values
        if (dataObject.hasOwnProperty(key)) {
          dataObject[key] = dataObject[key].concat(inputData[key]);
        } else {
          dataObject[key] = inputData[key];
        }
      } else {
        // If the property is not an array, assign the value directly
        dataObject[key] = inputData[key];
      }
    }
  }

  const separatedData = [];

for (const key in dataObject) {
  if (dataObject.hasOwnProperty(key)) {
    const values = dataObject[key];

    for (let i = 0; i < values.length; i++) {
      const obj = {};
      obj[key] = values[i];
      separatedData[i] = separatedData[i] || {};
      Object.assign(separatedData[i], obj);
    }
  }
}

console.log(separatedData);
Student.insertMany(separatedData);
res.redirect('studentList');



  } catch (error) {
    console.error('Error inserting table data:', error);
    res.status(500).send('Error inserting table data');
  }
});


// Connect to MongoDB and insert the data
app.post('/import', (req, res) => {
  const data = req.body;

  

      // Insert the data into MongoDB
      collection.insertMany(data, (err, result) => {
          if (err) {
              console.error('Failed to insert data into MongoDB:', err);
              return;
          }

          res.send('Data imported successfully!');
      });

      
  });


  function formatKhmerNumber(number) {
    const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
    const arabicDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  
    let formattedNumber = "";
    const numberString = String(number);
  
    for (let i = 0; i < numberString.length; i++) {
      const digit = numberString.charAt(i);
      const arabicIndex = arabicDigits.indexOf(digit);
      
      if (arabicIndex !== -1) {
        formattedNumber += khmerDigits[arabicIndex];
      } else {
        formattedNumber += digit;
      }
    }
  
    return formattedNumber;
  }

  function formatKhmerMonth(monthNumber) {
    const khmerMonths = [
      "មករា", "កុម្ភះ", "មិនា", "មេសា",
      "ឧសភា", "មិថុនា", "កក្កដា", "សីហា",
      "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"
    ];
  
    if (monthNumber >= 1 && monthNumber <= 12) {
      return khmerMonths[monthNumber - 1];
    } else {
      return "Invalid month number";
    }
  }

  function formatDollarAmount(amount) {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    return formattedAmount;
  }


  


app.listen(port, function() {
  console.log("Server started on port 3000.");
});
