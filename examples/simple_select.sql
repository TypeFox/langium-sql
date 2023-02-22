--one join
SELECT m.managerId FROM managers m JOIN employees e ON m.managerId=e.id WHERE m.employeeId = 123;
--all star on table
SELECT * FROM managers m;
--explicit cast
SELECT CAST(e.birthday AS INTEGER) FROM employees e;
--product table
SELECT lhs.name, rhs.name FROM employees lhs, employees rhs;
--sum salaries by manager
SELECT m.managerId, SUM(e.salary)
FROM managers m JOIN employees e ON m.employeeId=e.id
GROUP BY m.managerId;
--sub query in select expression
SELECT (SELECT id FROM employees);
--named sub query in table sources
SELECT tab.id FROM (SELECT id, name FROM employees) tab;
--unnamed sub query in table sources
SELECT id FROM (SELECT * FROM employees);
--sub query used for IN operator
SELECT id, name FROM employees WHERE id NOT IN (SELECT employeeId FROM managers WHERE managerId=123);
--implicit type conversion
SELECT 1 + 1.12345;