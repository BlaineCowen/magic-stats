#!/usr/bin/env Rscript

# Load required libraries
library(plumber)

# Set working directory to script location
setwd(dirname(parent.frame(2)$ofile))

# Load the API
api <- plumb("plumber.R")

# Configure API
api$setDocs(TRUE) # Enable Swagger docs
api$setDebug(TRUE) # Enable debug mode

# Start the API
cat("Starting NFL Stats API...\n")
cat("API will be available at: http://localhost:8000\n")
cat("Swagger docs at: http://localhost:8000/__docs__\n")
cat("Press Ctrl+C to stop\n\n")

# Run the API
api$run(host = "0.0.0.0", port = 8000)
