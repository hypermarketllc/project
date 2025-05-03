-- Update Discord queue processing interval

-- Create a function to process the queue more frequently
CREATE OR REPLACE FUNCTION process_discord_queue()
RETURNS void AS $$
DECLARE
  notification record;
  response_status integer;
  response_body text;
  error_message text;
BEGIN
  -- Process up to 10 unsent notifications at a time
  FOR notification IN
    SELECT * FROM discord_notifications
    WHERE sent = false
    ORDER BY created_at
    LIMIT 10
  LOOP
    BEGIN
      -- Send to Discord webhook
      SELECT
        status,
        content::text,
        CASE
          WHEN status >= 400 THEN content::text
          ELSE null
        END
      INTO
        response_status,
        response_body,
        error_message
      FROM
        http((
          'POST',
          notification.webhook_url,
          ARRAY[('Content-Type', 'application/json')],
          notification.message::text,
          5 -- 5 second timeout
        ));

      -- Update notification status
      IF response_status >= 200 AND response_status < 300 THEN
        UPDATE discord_notifications
        SET
          sent = true,
          sent_at = NOW(),
          error = NULL
        WHERE id = notification.id;
        
        RAISE NOTICE 'Successfully sent notification % for deal %', notification.id, notification.deal_id;
      ELSE
        UPDATE discord_notifications
        SET
          retry_count = retry_count + 1,
          error = COALESCE(error_message, 'HTTP Error ' || response_status)
        WHERE id = notification.id;
        
        RAISE NOTICE 'Failed to send notification % for deal %: %', 
          notification.id, notification.deal_id, COALESCE(error_message, 'HTTP Error ' || response_status);
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Update retry count and error message
      UPDATE discord_notifications
      SET
        retry_count = retry_count + 1,
        error = SQLERRM
      WHERE id = notification.id;
      
      RAISE NOTICE 'Exception sending notification % for deal %: %', 
        notification.id, notification.deal_id, SQLERRM;
    END;
    
    -- Small delay between requests to avoid rate limiting
    PERFORM pg_sleep(0.5);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run the queue processor every 10 seconds
SELECT cron.schedule(
  'process-discord-queue',  -- job name
  '*/10 * * * * *',        -- every 10 seconds (sec min hour day month day_of_week)
  $$SELECT process_discord_queue()$$
);

-- Check if the job was created
SELECT * FROM cron.job WHERE jobname = 'process-discord-queue';

-- Note: This requires the pg_cron extension to be installed and enabled
-- If pg_cron is not available, you'll need to set up an external cron job
-- or use a serverless function to call the process_discord_queue function