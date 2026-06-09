const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

dotenv.config({ quiet: true });

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "smartleave",
  DB_SSL = "false",
  DB_CREATE_DATABASE = "true",
} = process.env;

async function seed(connection) {
  const password = await bcrypt.hash("demo1234", 10);

  await connection.query(
    `INSERT IGNORE INTO departments (name, code, hod) VALUES
     ('Computer Science & Engineering', 'CSE', 'Dr. Priya Raman'),
     ('Electronics & Communication', 'ECE', 'Dr. Mohan Das'),
     ('Mechanical Engineering', 'MECH', 'Dr. Lakshmi'),
     ('Information Technology', 'IT', 'Dr. Karthik')`
  );

  await connection.query(
    `INSERT IGNORE INTO users (id,name,email,password,role,department,roll_no,phone) VALUES
     (1,'Arun Kumar','student@demo.com',?,'student','CSE','21CS045','+91 90000 00001'),
     (2,'Dr. Priya Raman','faculty@demo.com',?,'faculty','CSE',NULL,'+91 90000 00002'),
     (4,'Admin User','admin@demo.com',?,'admin',NULL,NULL,'+91 90000 00004')`,
    [password, password, password]
  );

  await connection.query(
    `INSERT IGNORE INTO users (id,name,email,password,role,department,roll_no,phone,child_id) VALUES
     (3,'Suresh Kumar','parent@demo.com',?,'parent',NULL,NULL,'+91 90000 00003',1)`,
    [password]
  );

  await connection.query(
    `INSERT IGNORE INTO leave_requests
     (id,user_id,category,from_date,to_date,reason,emergency,status,remarks,faculty_id,documents,missed_classes,assignments)
     VALUES
     (1,1,'medical',DATE_SUB(NOW(), INTERVAL 10 DAY),DATE_SUB(NOW(), INTERVAL 8 DAY),'Viral fever and doctor advised rest for 3 days.',0,'approved','Approved. Get well soon.',2,
      JSON_ARRAY(JSON_OBJECT('id','doc-1','name','medical_certificate.pdf','size',245000,'type','application/pdf','verified',true)),
      JSON_ARRAY(JSON_OBJECT('subject','Data Structures','date',DATE_SUB(NOW(), INTERVAL 10 DAY))),
      JSON_ARRAY(JSON_OBJECT('title','DBMS Assignment 3','dueDate',DATE_ADD(NOW(), INTERVAL 2 DAY)))),
     (2,1,'hackathon',DATE_ADD(NOW(), INTERVAL 3 DAY),DATE_ADD(NOW(), INTERVAL 5 DAY),'Selected for Smart India Hackathon finals at IIT Madras.',0,'pending',NULL,NULL,
      JSON_ARRAY(JSON_OBJECT('id','doc-2','name','sih_selection.pdf','size',180000,'type','application/pdf')),
      JSON_ARRAY(),
      JSON_ARRAY())`
  );

  await connection.query(
    `INSERT IGNORE INTO notifications (id,user_id,title,body,type,is_read,link) VALUES
     (1,1,'Leave approved','Your medical leave was approved.','leave_approved',0,'/leaves/1'),
     (2,2,'Hackathon leave request','Arun Kumar requested 3 days for SIH finals.','leave_submitted',0,'/faculty/requests'),
     (3,3,'Leave submitted','Arun submitted a hackathon leave request.','leave_submitted',1,NULL)`
  );
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [DB_NAME, tableName, columnName]
  );

  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?`,
    [DB_NAME, tableName, indexName]
  );

  return rows.length > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (!(await columnExists(connection, tableName, columnName))) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function migrateExistingSchema(connection) {
  await addColumnIfMissing(connection, "users", "department", "VARCHAR(80) NULL");
  await addColumnIfMissing(connection, "users", "roll_no", "VARCHAR(50) NULL");
  await addColumnIfMissing(connection, "users", "phone", "VARCHAR(40) NULL");
  await addColumnIfMissing(connection, "users", "child_id", "INT NULL");
  await addColumnIfMissing(connection, "users", "avatar_url", "VARCHAR(500) NULL");
  await addColumnIfMissing(connection, "users", "created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfMissing(
    connection,
    "users",
    "updated_at",
    "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  );

  await addColumnIfMissing(connection, "departments", "code", "VARCHAR(30) NULL");
  await addColumnIfMissing(connection, "departments", "hod", "VARCHAR(120) NULL");
  await addColumnIfMissing(connection, "departments", "created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await connection.query("UPDATE departments SET code=CONCAT('DEPT', id) WHERE code IS NULL OR code=''");
  await connection.query("UPDATE departments SET hod='Not assigned' WHERE hod IS NULL OR hod=''");
  if (!(await indexExists(connection, "departments", "code"))) {
    await connection.query("ALTER TABLE departments ADD UNIQUE INDEX code (code)");
  }

  await addColumnIfMissing(connection, "leave_requests", "from_date", "DATETIME NULL");
  await addColumnIfMissing(connection, "leave_requests", "to_date", "DATETIME NULL");
  await addColumnIfMissing(connection, "leave_requests", "emergency", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing(connection, "leave_requests", "remarks", "TEXT NULL");
  await addColumnIfMissing(connection, "leave_requests", "faculty_id", "INT NULL");
  await addColumnIfMissing(connection, "leave_requests", "documents", "JSON NULL");
  await addColumnIfMissing(connection, "leave_requests", "missed_classes", "JSON NULL");
  await addColumnIfMissing(connection, "leave_requests", "assignments", "JSON NULL");
  await addColumnIfMissing(connection, "leave_requests", "created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfMissing(
    connection,
    "leave_requests",
    "updated_at",
    "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  );
  if (await columnExists(connection, "leave_requests", "start_date")) {
    await connection.query("UPDATE leave_requests SET from_date=start_date WHERE from_date IS NULL");
  }
  if (await columnExists(connection, "leave_requests", "end_date")) {
    await connection.query("UPDATE leave_requests SET to_date=end_date WHERE to_date IS NULL");
  }

  await addColumnIfMissing(connection, "notifications", "type", "VARCHAR(40) NOT NULL DEFAULT 'info'");
  await addColumnIfMissing(connection, "notifications", "title", "VARCHAR(180) NULL");
  await addColumnIfMissing(connection, "notifications", "body", "TEXT NULL");
  await addColumnIfMissing(connection, "notifications", "is_read", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing(connection, "notifications", "link", "VARCHAR(255) NULL");
  await addColumnIfMissing(connection, "notifications", "created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await connection.query("UPDATE notifications SET title='Notification' WHERE title IS NULL OR title=''");
  await connection.query("UPDATE notifications SET body='No details available.' WHERE body IS NULL OR body=''");
  await connection.query("ALTER TABLE notifications MODIFY title VARCHAR(180) NOT NULL");
  await connection.query("ALTER TABLE notifications MODIFY body TEXT NOT NULL");
}

async function main() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_CREATE_DATABASE === "false" ? DB_NAME : undefined,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  if (DB_CREATE_DATABASE !== "false") {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  }
  await connection.query(`USE \`${DB_NAME}\``);

  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await connection.query(schema);
  await migrateExistingSchema(connection);
  await seed(connection);
  await connection.end();

  console.log(`Database "${DB_NAME}" is ready.`);
  console.log("Demo login password: demo1234");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
