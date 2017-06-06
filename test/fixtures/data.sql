\c cursor_pagination_test;

INSERT INTO manufacturers(name, country) VALUES
('Volvo', 'Sweden'),
('Ford', 'United States'),
('Buick', 'United States'),
('Dodge', 'United States'),
('Jeep', 'United States'),
('GMC', 'United States'),
('Chrysler', 'United States'),
('Chevrolet', 'United States'),
('Cadillac', 'United States'),
('Acura', 'Japan'),
('Infiniti', 'Japan'),
('Honda', 'Japan'),
('Lexus', 'Japan'),
('Mazda', 'Japan'),
('Mitsubishi', 'Japan'),
('Nissan', 'Japan'),
('Subaru', 'Japan'),
('Suzuki', 'Japan'),
('Toyota', 'Japan'),
('Audi', 'Germany'),
('BMW', 'Germany'),
('Mercedes-Benz', 'Germany'),
('Porsche', 'Germany'),
('Volkswagen', 'Germany');

INSERT INTO engines(name, energy_source) VALUES
('Diesel', 'diesel'),
('Electric', 'electric'),
('Internal Combustion', 'petrol');

INSERT INTO cars(manufacturer_id, engine_id, description) VALUES
(1, 3, 'Volvo V40');
