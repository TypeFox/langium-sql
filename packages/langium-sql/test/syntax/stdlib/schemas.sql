CREATE SCHEMA alpha;
CREATE SCHEMA omega;

CREATE TABLE alpha.people (
    id INT
);

CREATE TABLE omega.people (
    id CHAR
);

CREATE FUNCTION alpha.blubb(x REAL) AS INT;
