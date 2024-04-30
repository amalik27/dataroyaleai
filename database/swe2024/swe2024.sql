-- phpMyAdmin SQL Dump
-- version 5.1.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Mar 27, 2024 at 04:56 AM
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
-- Table structure for table `catalog`
--

CREATE TABLE IF NOT EXISTS`catalog` (
  `id` int(11) NOT NULL,
  `permissions` text NOT NULL,
  `cost` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `competitions`
--

CREATE TABLE IF NOT EXISTS`competitions` (
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
  `file_path` varchar(512) NOT NULL,
  `status` ENUM('pending', 'evaluating', 'complete') DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `competitions`
--

INSERT INTO `competitions` (`id`, `userid`, `title`, `deadline`, `prize`, `metrics`, `description`, `player_cap`, `date_created`, `inputs_outputs`, `file_path`) VALUES
(42161251, 1, "Noisy Wave Competition", "2024-04-06", 100, json_object("mse", 3, "speed", 1, "accuracy", 5), "A competiton to figure out to approximate this wave of ours.", 120, "2024-03-20", json_object("inputs", json_array("angle <number>"), "outputs", json_array("result <number>")), "../api-platform/TestDatasets/sine_wave.zip"),
(23456879, 1, "Pythag Competition", "2024-04-06", 100, json_object("rmse", 3, "mse", 1, "r2", 5), "A competiton to figure out the pythagorean theorem,", 120, "2024-03-20", json_object("inputs", json_array("a <number>","b <number>"), "outputs", json_array("hypotenuse <number>")), "../api-platform/TestDatasets/pythag.zip"),
(71393633, 2, "Competition B", "2024-06-06", 120, json_object("mse", 3, "speed", 1, "accuracy", 5), "A sample Competition", 120, "2024-03-20", json_object("inputs", json_array("images"), "outputs", json_array("name")), "./backend/controllers/goodcat.zip"), 
(1765057604, 3, "Digit Recognizer", "2024-05-13", 200, json_object("speed", 1, "accuracy", 2, "mse", 3), "In this competition, your goal is to correctly identify digits from a dataset of tens of thousands of handwritten images. We encourage you to experiment with different algorithms to learn first-hand what works well and how techniques compare.", 150, "2024-04-02", json_object("inputs", json_array("imageid"), "outputs", json_array("label")), "database\\apifiles\\validCompDB.zip");

-- --------------------------------------------------------

--
-- Table structure for table `leaderboard`
--

CREATE TABLE IF NOT EXISTS`leaderboard` (
  `user_id` int(30) NOT NULL,
  `comp_id` int(11) NOT NULL,
  `score` double NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE IF NOT EXISTS`submissions` (
  `comp_id` int(11) NOT NULL,
  `submission_id` int(11) NOT NULL,
  `score` double DEFAULT NULL,
  `file_path` varchar(512) DEFAULT NULL,
  `user_id` int(30) NOT NULL,
  `published` BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


INSERT INTO `submissions` (`comp_id`, `submission_id`, `score`, `file_path`, `user_id`, `published`) VALUES
(42161251, 8675954, NULL, '../api-platform/Euclid/', 1, true),
(42161251, 2890754, NULL, '../api-platform/Euclid/', 2, false),
(23456879, 5234543, NULL, '../api-platform/Pythagoras/', 1, true), 
(23456879, 5763454, NULL, '../api-platform/Pythagoras/', 2, false);
-- --------------------------------------------------------
-- docker exec -it swe2024-db-1 bash
--
-- Table structure for table `subscriptions`
--

CREATE TABLE IF NOT EXISTS`subscription_database` (
  `id` int(30) NOT NULL,
  `user` varchar(30) NOT NULL,
  `email` varchar(30) NOT NULL,
  `purchase_date` datetime,
  `expire_date` datetime,
  `tier` int(30) NOT NULL,
  `cost` int(30) NOT NULL,
  `credits` int(30) NOT NULL,
  `api_token` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO `subscription_database` (`id`, `user`, `email`, `purchase_date`, `expire_date`, `tier`, `cost`, `credits`, `api_token`) VALUES
(1, 'user1', 'test1@gmail.com', '20240318T002458', '20240418T002458', 1, 100, 2200, 'VvVmzazIy3UPf3km'),
(3, 'user3', 'test3@gmail.com', '20240314T200000', '20250314T200000', 1, 1000, 50, 'JkOWIiSUOnaDDL7Z');

-- --------------------------------------------------------

--
-- Table structure for table `tiers`
--

CREATE TABLE IF NOT EXISTS`tiers` (
  `TierLevel` int(30) NOT NULL,
  `Guarantee` int(11) NOT NULL,
  `Overload` decimal(10,0) NOT NULL,
  `ports` int(11) NOT NULL,
  `Uptime` decimal(10,0) NOT NULL,
  `OverloadUptime` decimal(10,0) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `tiers`
--

INSERT INTO `tiers` (`TierLevel`, `Guarantee`, `Overload`, `ports`, `Uptime`, `OverloadUptime`) VALUES
(1, 40, 20, 5, 2400, 10),
(2, 30, 15, 3, 1800, 5),
(3, 20, 10, 1, 1200, 0);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS`users` (
  `id` int(30) NOT NULL,
  `username` varchar(30) NOT NULL,
  `email` varchar(30) NOT NULL,
  `salt` varchar(30) NOT NULL,
  `password_encrypted` varchar(120) NOT NULL,
  `role` varchar(30) NOT NULL,
  `tier` int(30) NOT NULL,
  `credits` int(30) NOT NULL,
  `reg_date` datetime NOT NULL,
  `api_token` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


INSERT INTO `users` (`id`, `username`, `email`, `salt`, `password_encrypted`, `role`, `tier`, `credits`, `reg_date`, `api_token`) VALUES
(1, 'user1', 'test1@gmail.com', '7obtPxa5i4KG7rsA', 'e427aa220500aec74cdfc054c8e61d963d6d68dfb9deb6ae0dbff384d1f6d56b', 'competitor', 1, 2200, '2024-04-01 08:15:17', 'VvVmzazIy3UPf3km'),
(2, 'user2', 'test2@gmail.com', 'z70G5WVZSWCzLl7z', '7b2a429be0a5ea37326b2e4a892aa0bc34a517f0b7be0f97ddb6a8db7113b7e3', 'competitor', 1, 200, '2024-04-01 08:17:04', '2ho5qDRPFO99FtAm'),
(3, 'user3', 'test3@gmail.com', 'Qzkh3LAHsjliAhCI', 'a70a6bc6517d94c0446af8e5d69d5ee45279d8c84d9fd686e474a75130432aa2', 'competitor', 1, 50, '2024-04-01 08:17:58', 'JkOWIiSUOnaDDL7Z');

-- --------------------------------------------------------

--
-- Table structure for table `course_progress`
--

CREATE TABLE IF NOT EXISTS`course_progress` (
  `user_id` int(30) NOT NULL,
  `api_token` varchar(120) NOT NULL,
  `course_id` int(11) NOT NULL,
  `progress` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `course_progress`
--

INSERT INTO `course_progress` (`user_id`, `api_token`, `course_id`, `progress`) VALUES
(1, 'VvVmzazIy3UPf3km', 1, 1),
(1, 'VvVmzazIy3UPf3km', 2, 1),
(1, 'VvVmzazIy3UPf3km', 3, 1);
COMMIT;

-- --------------------------------------------------------
--
-- Indexes for dumped tables
--

--
-- Indexes for table `catalog`
--
ALTER TABLE `catalog`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `leaderboard`
--
ALTER TABLE `leaderboard`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `submissions`
--
ALTER TABLE `submissions`
  ADD PRIMARY KEY (`submission_id`);
--  ADD UNIQUE KEY `unique_user_comp_combination` (`user_id`,`comp_id`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscription_database`
  ADD PRIMARY KEY (`id`);



--
-- Indexes for table `tiers`
--
ALTER TABLE `tiers`
  ADD PRIMARY KEY (`TierLevel`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `subscriptions`
--
ALTER TABLE `subscription_database`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT;
COMMIT;


-- Replace 'password' with the actual password you want to set for 'tester'
GRANT ALL PRIVILEGES ON *.* TO 'tester'@'localhost' IDENTIFIED BY 'tester' WITH GRANT OPTION;
FLUSH PRIVILEGES;



/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
