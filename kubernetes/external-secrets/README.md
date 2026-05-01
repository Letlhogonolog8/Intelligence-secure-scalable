# External Secrets — AEGIS-AI

This directory replaces the placeholder `Secret/aegis-secrets` defined in
`kubernetes/02-configmap-secrets.yaml` with a managed source of truth (AWS
Secrets Manager **or** HashiCorp Vault), pulled into the cluster by the
[External Secrets Operator (ESO)](https://external-secrets.io/).

## Choose one backend

| Backend | Files to apply |
|---|---|
| AWS Secrets Manager | `01-secret-store-aws.yaml` + `02-external-secret-aegis.yaml` |
| HashiCorp Vault | `03-vault-alternative.yaml` only |

Do **not** apply both — they each create a `SecretStore` named
`aegis-aws-secrets` / `aegis-vault` and an `ExternalSecret` called
`aegis-secrets` that produces the same Kubernetes `Secret`.

## Cutover procedure

1. Install ESO into the cluster (one-time):

   ```bash
   helm repo add external-secrets https://charts.external-secrets.io
   helm install external-secrets external-secrets/external-secrets \
     -n external-secrets --create-namespace
   ```

2. Stage all secrets under `/aegis/production` (AWS) or
   `kv/aegis/production` (Vault). Use the keys listed in
   `02-external-secret-aegis.yaml`.

3. Verify the values via your secret manager's CLI:

   ```bash
   aws secretsmanager get-secret-value --secret-id /aegis/production --query SecretString --output text | jq .
   ```

4. Apply the manifests:

   ```bash
   kubectl apply -f kubernetes/external-secrets/
   kubectl get externalsecret -n aegis aegis-secrets    # status should be SecretSynced
   kubectl get secret -n aegis aegis-secrets             # the projected Secret
   ```

5. Delete the inline placeholder Secret from
   `kubernetes/02-configmap-secrets.yaml` (or replace it with a hash-only
   ConfigMap of non-secret values) and rotate every API + worker pod so
   they pick up the projected Secret:

   ```bash
   kubectl rollout restart deployment/aegis-api    -n aegis
   kubectl rollout restart deployment/aegis-worker -n aegis
   ```

## Rotation

Rotate values inside AWS Secrets Manager / Vault. ESO refreshes the
projected Secret every 30 minutes. To force an immediate refresh:

```bash
kubectl annotate externalsecret aegis-secrets -n aegis \
  force-sync=$(date +%s) --overwrite
```

After the projected Secret updates, restart the consumers to ensure they
read the new values from environment variables:

```bash
kubectl rollout restart deployment/aegis-api    -n aegis
kubectl rollout restart deployment/aegis-worker -n aegis
```
