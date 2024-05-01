-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Apr 01, 2024 at 03:05 PM
-- Server version: 5.7.39
-- PHP Version: 7.4.33

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

INSERT INTO `users` 
(`id`, `username`, `email`, `salt`, `password_encrypted`, `role`, `tier`, `credits`, `reg_date`, `api_token`) VALUES
(1, 'user1', 'test1@gmail.com', '7obtPxa5i4KG7rsA', 'e427aa220500aec74cdfc054c8e61d963d6d68dfb9deb6ae0dbff384d1f6d56b', 'competitor', 1, 50, '2024-04-01 08:15:17', 'VvVmzazIy3UPf3km'),
(2, 'user2', 'test2@gmail.com', 'z70G5WVZSWCzLl7z', '7b2a429be0a5ea37326b2e4a892aa0bc34a517f0b7be0f97ddb6a8db7113b7e3', 'competitor', 1, 50, '2024-04-01 08:17:04', '2ho5qDRPFO99FtAm'),
(3, 'user3', 'test3@gmail.com', 'Qzkh3LAHsjliAhCI', 'a70a6bc6517d94c0446af8e5d69d5ee45279d8c84d9fd686e474a75130432aa2', 'competitor', 1, 50, '2024-04-01 08:17:58', 'JkOWIiSUOnaDDL7Z');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
