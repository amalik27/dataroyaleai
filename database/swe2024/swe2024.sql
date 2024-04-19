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

CREATE TABLE `catalog` (
  `id` int(11) NOT NULL,
  `permissions` text NOT NULL,
  `cost` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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

INSERT INTO `competitions` (`id`, `userid`, `title`, `deadline`, `prize`, `metrics`, `description`, `player_cap`, `date_created`, `inputs_outputs`, `file_path`) VALUES
(42161251, 123456, "Competition A", "2024-05-06", 120, json_object("size", 3, "speed", 1, "accuracy", 5), "A sample Competition", 120, "2024-03-20", json_object("inputs", json_array("images"), "outputs", json_array("name")), "./backend/controllers/goodcat.zip"),
(71393633, 123456, "Competition B", "2024-06-06", 120, json_object("size", 3, "speed", 1, "accuracy", 5), "A sample Competition", 120, "2024-03-20", json_object("inputs", json_array("images"), "outputs", json_array("name")), "./backend/controllers/goodcat.zip"), 
(1765057604, 93625, "Digit Recognizer", "2024-05-13", 200, json_object("speed", 1, "accuracy", 2, "filesize", 3), "In this competition, your goal is to correctly identify digits from a dataset of tens of thousands of handwritten images. We encourage you to experiment with different algorithms to learn first-hand what works well and how techniques compare.", 150, "2024-04-02", json_object("inputs", json_array("imageid"), "outputs", json_array("label")), "database\\apifiles\\validCompDB.zip");

-- --------------------------------------------------------

--
-- Table structure for table `leaderboard`
--

CREATE TABLE `leaderboard` (
  `user_id` int(30) NOT NULL,
  `comp_id` int(11) NOT NULL,
  `score` double NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE `submissions` (
  `comp_id` int(11) NOT NULL,
  `submission_id` int(11) NOT NULL,
  `score` double DEFAULT NULL,
  `file_path` varchar(512) DEFAULT NULL,
  `user_id` int(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL,
  `user` int(11) NOT NULL,
  `purchase_date` datetime NOT NULL,
  `expire_date` datetime NOT NULL,
  `tier` int(11) NOT NULL,
  `cost` int(11) NOT NULL,
  `email` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `tiers`
--

CREATE TABLE `tiers` (
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
(1, 20, '10', 5, '60', '10'),
(2, 30, '15', 3, '45', '5'),
(3, 40, '20', 1, '35', '0');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
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

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `salt`, `password_encrypted`, `role`, `tier`, `credits`, `reg_date`, `api_token`) VALUES
(1, 'user1', 'test1@gmail.com', '7obtPxa5i4KG7rsA', 'e427aa220500aec74cdfc054c8e61d963d6d68dfb9deb6ae0dbff384d1f6d56b', 'competitor', 1, 50, '2024-04-01 08:15:17', 'VvVmzazIy3UPf3km'),
(2, 'user2', 'test2@gmail.com', 'z70G5WVZSWCzLl7z', '7b2a429be0a5ea37326b2e4a892aa0bc34a517f0b7be0f97ddb6a8db7113b7e3', 'competitor', 1, 50, '2024-04-01 08:17:04', '2ho5qDRPFO99FtAm'),
(3, 'user3', 'test3@gmail.com', 'Qzkh3LAHsjliAhCI', 'a70a6bc6517d94c0446af8e5d69d5ee45279d8c84d9fd686e474a75130432aa2', 'competitor', 1, 50, '2024-04-01 08:17:58', 'JkOWIiSUOnaDDL7Z'),
(5, 'organizer1', 'organizer1@gmail.com', 'db6AiGEsOqCArrjj', '47c8bcbc81c10a7d24656f198743d6846894a2098f3d7b95a64a7c173f1dd12a', 'organizer', 1, 10000, '2024-04-02 15:57:26', 'm6LNBR2sImI4xQsP'), 
(123456, "TestOrganizer", "organizer@gmail.com", "JGvblyx2XaGrQ8zH", "9847cc19a5508220c6e42c982d8385aac13ae10c2d19748695793f5b5924101e", "organizer", 1, 150, "2024-03-20 06:03:02", "Ya0xxc2yXf1Mxc7E"), 
(68, "Other Organizer", "wow@gmail.com", "OlWiZXyGmRNYMKQN", "6ffde83552b0d61309eaeefafb13e415c85ca5869f9b1bff098022c285dc42b2", "organizer", 1, 200, "2024-03-21 09:35:19", "3CLMo4ub2VgxccZl"), 
(129834, "Sample Competitor", "competitor@gmail.com", "aF5QP1nH9BiSs5eQ", "d2b5d6e4f7d60669fdba0447a0c3f0805a6e6a89ad6520d67c7bbf4bb87a2668", "competitor", 2, 100, "2024-03-21 10:48:28", "iFMnl8eRLBkJDhZ9"), 
(93625, "Another Organizer", "tester@gmail.com", "GORZjyat5j6XWYYq", "3a720784d7675fb72b5be51b7e04619cd1784cb77a1fb0aecb00f8a181a9789f", "organizer", 1, 20000, "2024-04-02 03:15:47", "RMQvg4zjaBo9J9cu");
COMMIT;

-- --------------------------------------------------------

--
-- Table structure for table `course_progress`
--

CREATE TABLE `course_progress` (
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
  ADD PRIMARY KEY (`submission_id`),
  ADD UNIQUE KEY `unique_user_comp_combination` (`user_id`,`comp_id`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
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
ALTER TABLE `subscriptions`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
