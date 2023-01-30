//one join
SELECT m.managerId FROM managers m JOIN employees e ON m.managerId=e.id WHERE m.employeeId = 123;
//all star on table
SELECT * FROM managers m;
//explicit cast
SELECT CAST(e.birthday AS INTEGER) FROM employees e;
//product table
SELECT lhs.name, ' likes ', rhs.name FROM employees lhs, employees rhs;
//sum salaries by manager
SELECT m.managerId, SUM(e.salary)
FROM managers m JOIN employees e ON m.employeeId=e.id
GROUP BY m.managerId;