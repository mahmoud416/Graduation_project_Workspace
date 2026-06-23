# Orbit Workspace — Deployment

Docker images, GitHub Actions CI/CD, and Kubernetes manifests for the full stack
(FastAPI backend + React/Vite frontend, MongoDB Atlas in production).

Docker Hub account: **mahmoud416**
- Backend image: `mahmoud416/orbit-backend`
- Frontend image: `mahmoud416/orbit-frontend`

---

## 1. Local development (Docker Compose)

Runs backend + frontend + a local MongoDB:

```bash
# from repo root
export JWT_SECRET_KEY="dev-secret"
export GEMINI_API_KEY="your-key"
docker compose up --build
```

- Frontend → http://localhost:8080
- Backend  → http://localhost:8000 (docs at /docs)
- MongoDB  → localhost:27017

The frontend container's Nginx reverse-proxies `/api` and `/ws` to the backend,
so the SPA uses relative API paths.

---

## 2. Build & push images manually

```bash
docker login -u mahmoud416

docker build -t mahmoud416/orbit-backend:latest ./backend
docker push mahmoud416/orbit-backend:latest

docker build -t mahmoud416/orbit-frontend:latest \
  --build-arg VITE_API_BASE=/api/v1 --build-arg VITE_API_URL= ./client
docker push mahmoud416/orbit-frontend:latest
```

CI does this automatically — see `.github/workflows/ci-cd.yml`.
Add two repository secrets in GitHub:

- `DOCKERHUB_USERNAME` = `mahmoud416`
- `DOCKERHUB_TOKEN`    = a Docker Hub access token

---

## 3. Deploy to Kubernetes

1. Create the real secret (never commit it):

   ```bash
   kubectl apply -f k8s/namespace.yaml
   kubectl -n orbit create secret generic backend-secret \
     --from-literal=MONGO_URI='mongodb+srv://...' \
     --from-literal=JWT_SECRET_KEY="$(openssl rand -hex 32)" \
     --from-literal=GEMINI_API_KEY='your-gemini-key'
   ```

2. Review `k8s/backend-config.yaml` (set `ALLOWED_ORIGINS` to your domain) and
   `k8s/ingress.yaml` (set the `host`).

3. Apply everything (skip the template secret if you created it in step 1):

   ```bash
   kubectl apply -k k8s/
   ```

4. Check rollout:

   ```bash
   kubectl -n orbit get pods,svc,ingress,hpa
   ```

### Notes
- Requires an **ingress-nginx** controller and a default **StorageClass**.
- For TLS, install cert-manager and uncomment the TLS lines in `ingress.yaml`.
- Backend runs a single replica by default because `uploads`/`chroma_data`
  use ReadWriteOnce PVCs. To scale out, switch to ReadWriteMany storage
  (or externalize Chroma) and enable the backend HPA in `hpa.yaml`.
