CREATE TABLE employees (
    id INTEGER,
    name CHAR(200),
    birthday REAL,
    salary REAL
);

CREATE TABLE managers (
    managerId INTEGER,
    employeeId INTEGER
);

CREATE FUNCTION SUM (summand REAL) AS INT;