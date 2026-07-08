FROM node:20-bookworm-slim

# Provides ogr2ogr. This default GDAL build can handle some DGN workflows.
# DWG and many DGN V8 workflows may require a custom GDAL build with ODA/Teigha
# or a separate CAD converter command configured with CAD_CONVERTER_COMMAND.
RUN apt-get update \
  && apt-get install -y --no-install-recommends gdal-bin ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
