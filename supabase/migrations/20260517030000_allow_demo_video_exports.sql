update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then null
  else (
    select array_agg(distinct mime_type)
    from unnest(allowed_mime_types || array['video/mp4', 'audio/wav']) as mime_type
  )
end
where id = 'proofpitch-exports';
