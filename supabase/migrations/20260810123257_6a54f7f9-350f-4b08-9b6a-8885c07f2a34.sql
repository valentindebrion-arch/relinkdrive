
CREATE OR REPLACE FUNCTION public.get_public_driver_reviews(_slug text, _limit int DEFAULT 3)
RETURNS TABLE(id uuid, rating smallint, comment text, created_at timestamptz, author_name text, author_avatar text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.rating, r.comment, r.created_at,
         COALESCE(NULLIF(split_part(COALESCE(p.full_name,''), ' ', 1), ''), 'Passager')
           || CASE WHEN NULLIF(split_part(COALESCE(p.full_name,''), ' ', 2), '') IS NOT NULL
                   THEN ' ' || upper(left(split_part(p.full_name, ' ', 2), 1)) || '.' ELSE '' END,
         p.avatar_url
  FROM public.ride_reviews r
  JOIN public.driver_profiles d ON d.user_id = r.driver_id
  LEFT JOIN public.profiles p ON p.id = r.client_id
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published
    AND r.status = 'visible'
  ORDER BY (r.comment IS NOT NULL AND length(btrim(r.comment)) > 0) DESC,
           r.rating DESC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 3), 20));
$$;

CREATE OR REPLACE FUNCTION public.get_public_driver_rating(_slug text)
RETURNS TABLE(rating_avg numeric, rating_count bigint, stars5 bigint, stars4 bigint, stars3 bigint, stars2 bigint, stars1 bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT round(avg(r.rating)::numeric, 2), count(*),
         count(*) FILTER (WHERE r.rating = 5),
         count(*) FILTER (WHERE r.rating = 4),
         count(*) FILTER (WHERE r.rating = 3),
         count(*) FILTER (WHERE r.rating = 2),
         count(*) FILTER (WHERE r.rating = 1)
  FROM public.ride_reviews r
  JOIN public.driver_profiles d ON d.user_id = r.driver_id
  WHERE d.slug = _slug
    AND d.verification_status = 'verified'
    AND d.page_published
    AND r.status = 'visible';
$$;

REVOKE ALL ON FUNCTION public.get_public_driver_reviews(text, int) FROM public;
REVOKE ALL ON FUNCTION public.get_public_driver_rating(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_driver_reviews(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_driver_rating(text) TO anon, authenticated;
