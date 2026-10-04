var server = require("express");
var bodyParser = require("body-parser");
var mysql = require("mysql2");
var util = require("util");
var url = require("url");
var upload = require("express-fileupload");
var session = require("express-session");
const { time } = require("console");
require("dotenv").config();

var conn = mysql.createConnection({
    host: "behveskt9btebu5fejo1-mysql.services.clever-cloud.com",
    user: "ueymzqxzyeui7v2h",
    password: "6KFpNX2XUR1vrPFEusun",
    database: "behveskt9btebu5fejo1"
});

var app = server();
app.use(upload());
app.use(server.static("public"));
// Session setup
app.use(session({
    secret: "abcdefg",
    resave: true,
    saveUninitialized: true
}));

var exe = util.promisify(conn.query).bind(conn);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(server.static("public/"));

// Home route
app.get('/', function(req, res){
    res.render("home.ejs");
});

// Registration
app.post('/save_registration', async function(req, res){
    try {
        var d = req.body;

        if(d.staff_password !== d.Confirm_password){
            res.render("password mismatch");
            
        }

        var sql = "INSERT INTO staff(staff_name,staff_email,staff_mobile,staff_password,staff_hospital_name) VALUES(?,?,?,?,?)";
        var data = await exe(sql,[d.staff_name,d.staff_email,d.staff_mobile,d.staff_password,d.staff_hospital_name]);

        // Set session
        req.session.staff_id = data.insertId;

        res.redirect("/dashboard");

    } catch(err) {
        console.log(err);
        res.send("Error Occurred: " + err);
    }
});

// Staff Login
app.post('/staff_login', async function(req, res){
    try {
        var d = req.body;
        var sql = "SELECT * FROM staff WHERE staff_email=? AND staff_password=?";
        var data = await exe(sql, [d.staff_email, d.staff_password]);

        if(data.length > 0){
            req.session.staff_id = data[0].staff_id;
            res.redirect("/dashboard");
        } else {
            res.render("invalid_login.ejs");
        }
    } catch(err) {
        console.log(err);
        res.send("Error Occurred: " + err);
    }
});

// Middleware to protect routes
function checkLogin(req, res, next) {
    if (!req.session.staff_id) {
        return res.send("Unauthorized: Please login first");
    }
    next();
}

app.get('/navbar', function(req, res){
    var sql = "SELECT * FROM staff WHERE staff_id=?";
    var data = exe(sql, [req.session.staff_id]);
    
    res.render("navbar.ejs", { staff: data });
});

// Dashboard (protected)
app.get('/dashboard', checkLogin, async function(req, res){
    var sql = `
      SELECT 
        (SELECT COUNT(*) FROM doctors WHERE staff_id=?) AS total_doctors,
        (SELECT COUNT(*) FROM appointments a 
         JOIN doctors d ON a.doctor_id=d.doctor_id 
         WHERE d.staff_id=?) AS total_appointments,
        (SELECT COUNT(*) FROM appointments a 
         JOIN doctors d ON a.doctor_id=d.doctor_id 
         WHERE d.staff_id=? AND a.appointment_status='Pending') AS pending_appointments,
        (SELECT COUNT(*) FROM appointments a 
         JOIN doctors d ON a.doctor_id=d.doctor_id 
         WHERE d.staff_id=? AND a.appointment_status='Completed') AS completed_appointments
    `;
    
    // Pass staff_id 4 times for the 4 subqueries
    var data = await exe(sql, [req.session.staff_id, req.session.staff_id, req.session.staff_id, req.session.staff_id]);
    
    res.render('dashboard.ejs', { data });

    
   
});


// Add Doctor page
app.get('/add_doctor', checkLogin, function(req, res){
    res.render("add_doctor.ejs");
});

// Save Doctor
app.post('/save_doctor', checkLogin, async function(req, res){
    try {
        var d = req.body;

        var sql = `INSERT INTO doctors(staff_id, doctor_name, doctor_specialization, doctor_in_time, doctor_out_time, avg_checkup_minutes)
                   VALUES (?, ?, ?, ?, ?, ?)`;
        await exe(sql, [
            req.session.staff_id,
            d.doctor_name,
            d.doctor_specialization,
            d.doctor_in_time,
            d.doctor_out_time,
            d.avg_checkup_minutes
        ]);

        res.redirect('/add_doctor');
    } catch(err) {
        console.log(err);
        res.send("Error Occurred: " + err);
    }
});

// View Doctors
app.get('/view_doctors', checkLogin, async function(req, res){
    var sql = "SELECT * FROM doctors WHERE staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
    res.render("view_doctors.ejs", { doctors: data });
});

// Edit Doctor
app.get('/edit_doctor/:id', checkLogin, async function(req, res){
    var sql = "SELECT * FROM doctors WHERE staff_id=? AND doctor_id=?";
    var data = await exe(sql, [req.session.staff_id, req.params.id]);
    res.render("edit_doctor.ejs", { doctor: data[0] });
});

// Update Doctor
app.post('/update_doctor', checkLogin, async function(req, res){
    try {
        var d = req.body;
        var sql = "UPDATE doctors SET doctor_name=?, doctor_specialization=?, doctor_in_time=?, doctor_out_time=?, avg_checkup_minutes=? WHERE staff_id=? AND doctor_id=?";
        await exe(sql, [
            d.doctor_name,
            d.doctor_specialization,
            d.doctor_in_time,
            d.doctor_out_time,
            d.avg_checkup_minutes,
            req.session.staff_id,
            d.doctor_id
        ]);
        res.redirect('/view_doctors');
    } catch(err) {
        console.log(err);
        res.send("Error Occurred: " + err);
    }
});

// Delete Doctor
app.get('/delete_doctor/:id', checkLogin, async function(req, res){
    try {
        var sql = "DELETE FROM doctors WHERE staff_id=? AND doctor_id=?";
        await exe(sql, [req.session.staff_id, req.params.id]);
        res.redirect('/view_doctors');
    } catch(err) {
        console.log(err);
        res.send("Error Occurred: " + err);
    }
});

// Add New Appointment page
app.get('/add_new_appointment', checkLogin, async function(req, res){
    var sql = "SELECT * FROM doctors WHERE staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
    res.render("add_new_appointment.ejs", { doctors: data });
});

// Save Appointment
app.post('/save_appointment', checkLogin, async function(req, res) {
    var d = req.body;
    var sql = `INSERT INTO appointments(staff_id, doctor_id, patient_name, patient_mobile, patient_address, patient_disease_note, appointment_date)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await exe(sql, [
        req.session.staff_id,
        d.doctor_id,
        d.patient_name,
        d.patient_mobile,
        d.patient_address,
        d.patient_disease_note,
        d.appointment_date
    ]);
    res.redirect('/view_appointments');
});

app.get('/view_appointments', checkLogin, async function(req, res){
    
    var urlData = url.parse(req.url, true).query;
   console.log(urlData);

    var sql = `SELECT * ,
    (SELECT COUNT(*) FROM appointments WHERE appointment_status='Pending' AND appointments.doctor_id=doctors.doctor_id) AS total
    FROM doctors WHERE staff_id=?`;
    var doctors = await exe(sql, [req.session.staff_id]);   


if(urlData.doctor_id){
 var sql = "SELECT * FROM appointments, doctors WHERE appointment_status='Pending' AND appointments.doctor_id=doctors.doctor_id AND appointments.staff_id=? AND appointments.doctor_id=?";
    var data = await exe(sql, [req.session.staff_id, urlData.doctor_id]);
}else{
 var sql = "SELECT * FROM appointments, doctors WHERE appointment_status='Pending' AND appointments.doctor_id=doctors.doctor_id AND appointments.staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
}
   
    var packet = { appointments: data, doctors: doctors };
    res.render("view_appointments.ejs", packet);
});

//edit_appointment
app.get('/edit_appointment/:id', checkLogin, async function(req, res){
    var sql = "SELECT * FROM appointments WHERE staff_id=? AND appointment_id=?";
    var data = await exe(sql, [req.session.staff_id, req.params.id]);
    res.render("edit_appointment.ejs", { appointment: data[0] });
});

//update appoinment
app.post('/update_appointment',checkLogin,async function(req,res){
    var d = req.body;
    var sql =  `UPDATE appointments SET patient_name=?, patient_mobile=?,  appointment_date=? WHERE staff_id=? AND appointment_id=?`;
    var data = await exe(sql, [
        d.patient_name,
        d.patient_mobile,
        d.appointment_date,
         d.staff_id,
        d.appointment_id
    ]);
    res.redirect('/view_appointments');
});

app.get('/delete_appointment/:id', checkLogin, async function(req, res){
    var sql = "DELETE FROM appointments WHERE staff_id=? AND appointment_id=?";
    await exe(sql, [req.session.staff_id, req.params.id]);
    res.redirect('/view_appointments');
});

app.get('/appointment_details/:id', checkLogin, async function(req, res) {
    var sql = `SELECT * FROM appointments, doctors 
               WHERE appointments.doctor_id = doctors.doctor_id 
               AND appointments.appointment_id = ?`;
    var data = await exe(sql, [req.params.id]);
    res.render("appointment_details.ejs", { appointment: data[0] }); // single object
});

// complete appointment
app.post('/complete_appointment', checkLogin, async function (req, res) {
    var d = req.body;
    var sql = `UPDATE appointments 
               SET appointment_start_time=?, appointment_end_time=?, 
                   patient_age=?, patient_gender=?, prescription=?, 
                   appointment_status='Completed' 
               WHERE appointment_id=?`;

    await exe(sql, [
        d.appointment_start_time,
        d.appointment_end_time,
        d.patient_age,
        d.patient_gender,
        d.prescription,
        d.appointment_id
    ]);

    // Redirect to appointment list page
    res.redirect('/view_appointments');
});

app.get('/view_completed_appointments', checkLogin, async function (req, res) {
    var sql = "SELECT * FROM appointments,doctors WHERE appointment_status='Completed' AND appointments.doctor_id=doctors.doctor_id AND appointments.staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
     var urlData = url.parse(req.url, true).query;
   console.log(urlData);

    var sql = `SELECT * ,
    (SELECT COUNT(*) FROM appointments WHERE appointment_status='Completed' AND appointments.doctor_id=doctors.doctor_id) AS total
    FROM doctors WHERE staff_id=?`;
    var doctors = await exe(sql, [req.session.staff_id]);   


if(urlData.doctor_id){
 var sql = "SELECT * FROM appointments, doctors WHERE appointment_status='Completed' AND appointments.doctor_id=doctors.doctor_id AND appointments.staff_id=? AND appointments.doctor_id=?";
    var data = await exe(sql, [req.session.staff_id, urlData.doctor_id]);
}else{
 var sql = "SELECT * FROM appointments, doctors WHERE appointment_status='Completed' AND appointments.doctor_id=doctors.doctor_id AND appointments.staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
}
   
    var packet = { appointments: data, doctors: doctors };
    res.render("view_completed_appointments.ejs", packet);
});


//edit profile
app.get('/edit_profile_by_staff', checkLogin, async function(req, res){
    var sql = "SELECT * FROM staff WHERE staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
    res.render("edit_profile_by_staff.ejs", { staff: data[0] });
    
});

app.post('/update_profile_by_staff', checkLogin, async function(req, res) {
    var newname = Date.now() + ".png";

    // Fix file path
    req.files.staff_photo.mv(__dirname + "/public/images/" + newname, function(err) {
        if (err) {
            console.log(err);
            return res.status(500).send("File upload error");
        }
    });

    var d = req.body;
    var sql = `UPDATE staff SET staff_name=?, staff_mobile=?, staff_photo=? WHERE staff_id=?`;
    var data = await exe(sql, [
        d.staff_name,
        d.staff_mobile,
        newname,
        d.staff_id
    ]);
    req.session.staff_name = d.staff_name;
     req.session.staff_photo = newname;
    res.redirect('/dashboard');
});

//profile data
app.get('/profile_data', checkLogin, async function(req, res) {
    var sql = "SELECT * FROM staff WHERE staff_id=?";
    var data = await exe(sql, [req.session.staff_id]);
    res.json({ staff: data[0] }); // staff चा data JSON मध्ये परत करतो
});
// Logout
app.get('/logout', function(req, res){
    req.session.destroy();
    res.redirect('/');
});

// Start Server
app.listen(process.env.PORT || 1000, function(){
    console.log("Server running on port " + (process.env.PORT || 1000));
});
