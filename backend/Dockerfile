FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies (من requirements + daphne لو مش موجودة)
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir daphne

# Copy the entire backend project
COPY . .

# Add current directory to Python path
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Run server via ASGI (Daphne)
CMD ["sh", "-c", "python manage.py migrate && python manage.py collectstatic --noinput && daphne -b 0.0.0.0 -p 8000 backend.asgi:application"]
