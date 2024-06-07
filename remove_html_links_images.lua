function RawBlock(el)
  if el.format:match('html') then
    return {}
  else
    return el
  end
end

function RawInline(el)
  if el.format:match('html') then
    return pandoc.Str("")
  else
    return el
  end
end

function Link(el)
  return pandoc.Str("")
end

function Image(el)
  return pandoc.Str("")
end

function Figure(el)
	return pandoc.Str("")
end

