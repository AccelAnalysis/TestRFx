Apply db/organization-media.sql after db/organization-profile.sql.

The migration stores organization-owned intro media metadata only. Linked YouTube/Vimeo videos remain provider-hosted; future RFxchange uploads store object-storage references rather than video blobs in PostgreSQL.
