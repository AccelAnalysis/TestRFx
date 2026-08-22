-- Prevent RFxchange-hosted submission from claiming device-local attachment
-- metadata as an authoritative shared response package.
-- Apply after db/rfx-domain.sql and db/rfx-mobile-transaction-runtime.sql.

CREATE OR REPLACE FUNCTION reject_device_only_rfx_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.response_data::text LIKE '%device-attachment:%' THEN
    RAISE EXCEPTION
      'Device-only attachments must be synchronized to authoritative shared storage before RFxchange-hosted submission.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rfx_response_device_attachment_guard ON rfx_responses;
CREATE TRIGGER rfx_response_device_attachment_guard
BEFORE INSERT OR UPDATE OF status, response_data ON rfx_responses
FOR EACH ROW
EXECUTE FUNCTION reject_device_only_rfx_submission();
