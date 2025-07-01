# Install system dependencies for arrow
system("apt-get update && apt-get install -y libcurl4-openssl-dev libssl-dev libxml2-dev")

# Install arrow from CRAN (pre-compiled binaries)
if (!require("arrow", quietly = TRUE)) {
    install.packages("arrow", repos = "https://cloud.r-project.org", type = "binary")
}

# Install other required packages
if (!require("plumber", quietly = TRUE)) {
    install.packages("plumber")
}

if (!require("dplyr", quietly = TRUE)) {
    install.packages("dplyr")
}

if (!require("jsonlite", quietly = TRUE)) {
    install.packages("jsonlite")
}

if (!require("nflreadr", quietly = TRUE)) {
    install.packages("nflreadr", repos = c("https://nflverse.r-universe.dev", "https://cloud.r-project.org"))
}

# Load libraries
library(plumber)
library(dplyr)
library(jsonlite)
library(nflreadr)
library(arrow)

cat("All packages installed and loaded successfully!\n")
