-- \c cursor_pagination_test;

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
('Volkswagen', 'Germany'),
('Tesla', 'United States')
;

INSERT INTO engines(name, energy_source) VALUES
('Diesel', 'diesel'),
('Electric', 'electric'),
('Internal Combustion', 'petrol')
;

INSERT INTO cars(manufacturer_id, engine_id, description) VALUES
(1, 3, 'Volvo V40'),
(2, 3, 'Mustang'),
(2, 3, 'Focus'),
(3, 3, 'Regal'),
(4, 3, 'Challenger'),
(5, 3, 'Wrangler'),
(6, 3, 'Yukon'),
(7, 3, '300'),
(8, 3, 'Cruze'),
(8, 3, 'Impala'),
(9, 3, 'Escalade'),
(10, 3, 'NSX'),
(11, 3, 'Q50'),
(12, 3, 'Civic'),
(13, 3, 'RX'),
(14, 3, 'Miata'),
(15, 3, 'Lancer'),
(16, 3, 'GT-R'),
(17, 3, 'Impreza'),
(18, 3, 'Swift'),
(19, 3, 'Prius'),
(20, 3, 'A6'),
(21, 3, '3 Series'),
(22, 3, 'E-Class'),
(23, 3, '911'),
(24, 1, 'Jetta'),
(25, 2, 'Model S')
;
