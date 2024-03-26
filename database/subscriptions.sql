-- phpMyAdmin SQL Dump
-- version 5.1.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Feb 25, 2024 at 10:24 PM
-- Server version: 5.7.24
-- PHP Version: 8.0.1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `swe2024`
--

-- --------------------------------------------------------

--
-- Table structure for table `subscription_database`
--

CREATE TABLE `subscription_database` (
  `id` int(30) NOT NULL COMMENT 'pulled from user db',
  `user` varchar(30) NOT NULL COMMENT 'pulled from user db',
  `email` varchar(30) NOT NULL COMMENT 'pulled from user db',
  `purchase_date` varchar(30) DEFAULT NULL,
  `expire_date` varchar(30) DEFAULT NULL,
  `tier` int(30) NOT NULL,
  `cost` int(30) NOT NULL,
  `credits` int(30) NOT NULL COMMENT 'maybe pulled from user db'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `subscription_database`, miscellaneous values for testing/demo purposes
--

INSERT INTO `subscription_database` (`id`, `user`, `email`, `purchase_date`, `expire_date`, `tier`, `cost`, `credits`) VALUES
(10000000, 'Username1', 'temp@gmail.com', '20240318T002458', '20240418T002458', 1, 100, 375),
(10000008, 'testUser_Name13', 'bleh@gmail.com', '20240317T204601', '20240417T204601', 2, 200, 250),
(20000000, 'Coder711', 'temp@gmail.com', '20240314T200000', '20250314T200000', 1, 1000, 300),
(20000008, 'otherUSNM_2', 'different@email.com', NULL, NULL, 0, 1000, 2000),
(30000000, 'MiscName303', 'realEmail@rutgers.edu', '20240203T120000', '20240303T120000', 1, 100, 70),
(40000000, '1Michael1', 'name@att.net', '20240828T200000', '20250828T200000', 1, 100, 200),
(50000000, 'StringName77', 'something@yahoo.net', '20241111T025039', '20241211T025039', 1, 100, 153),
(60000000, 'NoSub874', 'doesntMatter@rutgers.edu', NULL, NULL, 0, 0, 100),
(70000000, 'T2Subber', 'emailEmail@email.com', '20240318T004009', '20240418T004009', 1, 100, 375),
(80000000, 'tempUSNM', 'gmail@email.net', '20240325T180848', '20250325T180848', 1, 1000, 3000),
(90000000, 'creative_Username11', 'newName@thing.edu', '20240325T182223', '20240425T182223', 2, 200, 1000);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
