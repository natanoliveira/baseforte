CREATE INDEX "Neighborhood_geom_gist" ON "Neighborhood" USING GIST ("geom");
CREATE INDEX "Neighborhood_centroid_gist" ON "Neighborhood" USING GIST ("centroid");
CREATE INDEX "Supporter_mapPoint_gist" ON "Supporter" USING GIST ("mapPoint");
CREATE INDEX "VotingPlace_location_gist" ON "VotingPlace" USING GIST ("location");
