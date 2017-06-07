-- DROP DATABASE cursor_pagination_test;
-- CREATE DATABASE cursor_pagination_test;
-- \c cursor_pagination_test;

CREATE TABLE manufacturers (
  id bigserial primary key,
  name text,
  country text
);

CREATE TYPE energy_source AS ENUM (
  'electric',
  'petrol',
  'diesel'
);

CREATE TABLE engines (
  id bigserial primary key,
  name text,
  energy_source energy_source,
  description text
);

CREATE TABLE cars (
  id bigserial primary key,
  manufacturer_id bigint references manufacturers(id),
  engine_id bigint references engines(id),
  description text
);
