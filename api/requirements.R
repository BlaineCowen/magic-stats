# R package requirements for NFL Stats API (R-only version)

# Install required packages
if (!require("plumber", quietly = TRUE)) {
    install.packages("plumber")
}

if (!require("dplyr", quietly = TRUE)) {
    install.packages("dplyr")
}

if (!require("jsonlite", quietly = TRUE)) {
    install.packages("jsonlite")
}

# Install nflreadr from nflverse universe (pre-built, much lighter than nflfastR)
if (!require("nflreadr", quietly = TRUE)) {
    install.packages("nflreadr", repos = c("https://nflverse.r-universe.dev", "https://cloud.r-project.org"))
}

# Install memoise for function caching
if (!require("memoise", quietly = TRUE)) {
    install.packages("memoise", repos = "https://cloud.r-project.org")
}

# Install arrow for efficient data handling
if (!require("arrow", quietly = TRUE)) {
    install.packages("arrow", repos = "https://cloud.r-project.org")
}

# Load libraries
library(plumber)
library(dplyr)
library(jsonlite)
library(nflreadr)
library(memoise)
library(arrow)

cat("All packages installed and loaded successfully!\n")
