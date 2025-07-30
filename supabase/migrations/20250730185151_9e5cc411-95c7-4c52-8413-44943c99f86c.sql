-- Call the edge function to update user password
SELECT extensions.http_post_sync(
  'https://frkqhvdsrjuxgcfjbtsp.supabase.co/functions/v1/update-user-password',
  '{"userId": "0cff49dd-dda2-4253-9863-d4309fb99c4c", "newPassword": "161903"}',
  'application/json'
) as result;