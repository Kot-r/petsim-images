# Pet Sim Images
Allows to get ps99 &amp; pets go images without excessive rate limits

It uses official BIG Games API, if something is not there — it's likely a problem with their API!

All images are stored in the `images` folder, and named `[ID].png`.

To get a certain image, you can use `(game).biggamesapi.io/api/collection/(collection)` and find the thumbnail, then, remove the "rbxassetid://" and add ".png" at the end, that's the file name!

Images update and automatically upload here once per ~2 hours to prevent rate limits!

Tip: you can use the `image_missing.png` file if the image is missing, and use `shiny.png` for shiny pets, fruits and empowered enchants!

> Current Script Version: 3.1
> 
> Recent Changes:
> - Everything is dynamic now, hopefully it'll fetch all images now
> - FIX: excluding Sounds because the errors slow down

NOTE: Please do not use raw.githubusercontent.com to get images to avoid rate limits & excessive usage! I recommend using other services that cache images on their services instead!
There's a few of them online which work well with GitHub.
