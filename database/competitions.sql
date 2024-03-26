-- phpMyAdmin SQL Dump
-- version 5.1.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 14, 2024 at 10:01 PM
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
-- Table structure for table `competitions`
--

CREATE TABLE `competitions` (
  `id` int(11) NOT NULL,
  `userid` int(30) NOT NULL,
  `title` varchar(100) NOT NULL,
  `deadline` date NOT NULL,
  `prize` int(11) NOT NULL,
  `metrics` json NOT NULL,
  `description` varchar(6000) NOT NULL,
  `player_cap` int(11) NOT NULL,
  `date_created` date NOT NULL,
  `inputs_outputs` json NOT NULL,
  `file_path` varchar(512) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `competitions`
--

INSERT INTO `competitions` (`id`, `userid`, `title`, `deadline`, `prize`, `metrics`, `description`, `player_cap`, `date_created`, `file_path`) VALUES
(505748451, 1, 'Test Create Competition', '2027-03-04', 5000, 'null', 'Test Create Competition (Description)', 50, '2024-03-12', ''),
(1234567890, 1, 'Predictive Playoffs Challenge', '2025-03-26', 200, 'null', `Welcome to the Predictive Playoffs Challenge, where the thrill of sports meets the power of machine learning! In this competition, participants will harness their data-driven skills to predict the outcomes of upcoming playoff matches in a popular sports league. Whether you're a seasoned data scientist or a passionate sports enthusiast with a knack for analytics, this competition is your chance to showcase your predictive prowess.\r\n\r\nParticipants will be provided with historical data, team statistics, player performance metrics, and other relevant information to build and train their machine learning models. The goal is to accurately forecast the winners of playoff games, taking into account various factors that influence the outcomes.\r\n\r\nGet ready to dive into the world of sports analytics, push the boundaries of prediction accuracy, and compete against fellow enthusiasts for the coveted title of Predictive Playoffs Champion. May the best model win!`, 150, '2024-03-12', '');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `competitions`
--
ALTER TABLE `competitions`
  ADD PRIMARY KEY (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
