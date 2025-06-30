FROM rocker/r-ver:4.3.2

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install R packages
COPY requirements.R .
RUN Rscript requirements.R

# Copy API files
COPY plumber.R .

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 8000

# Start the API
CMD ["Rscript", "-e", "plumber::plumb('plumber.R')$run(host='0.0.0.0', port=8000)"] 