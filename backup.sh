filename=backupdata/bathrooms-$(date +'%y%m%d-%H%M').json

mongoexport --db test --collection bathrooms --out $filename --host 127.0.0.1:27017
